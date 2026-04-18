import { expect, test, vi } from 'vitest'
import {
  assembleAPNG,
  createExportSpec,
  estimateAnimationDuration,
  exportSpecAsPNG,
  serializeSVG
} from '../../src/playground/exportImage.js'

test('createExportSpec() clones the spec and applies export dimensions', () => {
  const spec = {
    plot: {
      type: 'point',
      data: [{ x: 1, y: 2 }],
      encodings: { x: 'x', y: 'y' }
    }
  }

  const exportSpec = createExportSpec(spec, { width: 320, height: 240 })

  expect(exportSpec).not.toBe(spec)
  expect(exportSpec.width).toBe(320)
  expect(exportSpec.height).toBe(240)
  expect(spec.width).toBeUndefined()
})

test('serializeSVG() makes the rendered SVG standalone', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', '12')
  svg.appendChild(circle)

  const text = serializeSVG(svg, { width: 320, height: 240 })

  expect(text).toContain('xmlns="http://www.w3.org/2000/svg"')
  expect(text).toContain('width="320"')
  expect(text).toContain('height="240"')
  expect(text).toContain('viewBox="0 0 320 240"')
  expect(text).toContain('<circle')
})

test('exportSpecAsPNG() renders a static SVG and downloads a PNG', async () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const render = vi.fn(() => ({ node: svg }))
  const fillRect = vi.fn()
  const scale = vi.fn()
  const drawImage = vi.fn()
  const toBlob = vi.fn((callback) => {
    callback(new Blob(['png'], { type: 'image/png' }))
  })
  const canvas = {
    getContext: vi.fn(() => ({
      fillRect,
      scale,
      drawImage,
      set fillStyle(value) {
        this.value = value
      }
    })),
    toBlob
  }
  const anchor = {
    click: vi.fn()
  }
  const createdURLs = []
  const createObjectURL = vi.fn((value) => {
    const url = value.type === 'image/png' ? 'blob:png' : 'blob:svg'
    createdURLs.push(url)
    return url
  })
  const revokeObjectURL = vi.fn()
  const createImage = () => ({
    set src(value) {
      this.value = value
      this.onload()
    }
  })

  await exportSpecAsPNG(
    {
      plot: {
        type: 'point',
        data: [{ x: 1, y: 2 }],
        encodings: { x: 'x', y: 'y' }
      }
    },
    {
      autoLayout: false,
      createAnchor: () => anchor,
      createCanvas: () => canvas,
      createImage,
      createObjectURL,
      filename: 'chart.png',
      height: 240,
      render,
      revokeObjectURL,
      scale: 3,
      width: 320
    }
  )

  expect(render).toHaveBeenCalledWith(
    expect.objectContaining({ width: 320, height: 240 }),
    expect.objectContaining({
      autoLayout: false,
      autoplay: false,
      width: 320,
      height: 240
    })
  )
  expect(canvas.width).toBe(960)
  expect(canvas.height).toBe(720)
  expect(fillRect).toHaveBeenCalledWith(0, 0, 960, 720)
  expect(scale).toHaveBeenCalledWith(3, 3)
  expect(drawImage).toHaveBeenCalledWith(
    expect.any(Object),
    0,
    0,
    320,
    240
  )
  expect(anchor.href).toBe('blob:png')
  expect(anchor.download).toBe('chart.png')
  expect(anchor.click).toHaveBeenCalledTimes(1)
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:svg')
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:png')
  expect(createdURLs).toEqual(['blob:svg', 'blob:png'])
})

test('estimateAnimationDuration() includes per-mark stagger time', () => {
  expect(
    estimateAnimationDuration({
      plots: [
        {
          animation: {
            enter: {
              delay: 80,
              duration: 400,
              stagger: 60
            }
          },
          marks: [{}, {}, {}]
        },
        {
          animation: {
            enter: {
              delay: 40,
              duration: 700
            }
          },
          marks: [{}]
        }
      ]
    })
  ).toBe(740)
})

test('assembleAPNG() wraps PNG frames with APNG animation chunks', () => {
  const frameA = createMockPNGFrame(Uint8Array.from([1, 2, 3]))
  const frameB = createMockPNGFrame(Uint8Array.from([4, 5, 6]))

  const apng = assembleAPNG([frameA, frameB], [80, 120], { plays: 0 })
  const chunkTypes = readChunkTypes(apng)
  const acTLChunk = readChunkData(apng, 'acTL')

  expect(chunkTypes).toEqual([
    'IHDR',
    'acTL',
    'fcTL',
    'IDAT',
    'fcTL',
    'fdAT',
    'IEND'
  ])
  expect(readUint32(acTLChunk, 0)).toBe(2)
  expect(readUint32(acTLChunk, 4)).toBe(0)
})

test('assembleAPNG() plays once by default', () => {
  const frame = createMockPNGFrame(Uint8Array.from([1, 2, 3]))
  const apng = assembleAPNG([frame], [120])
  const acTLChunk = readChunkData(apng, 'acTL')

  expect(readUint32(acTLChunk, 0)).toBe(1)
  expect(readUint32(acTLChunk, 4)).toBe(1)
})

function createMockPNGFrame(idatData) {
  return concatBytes(
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    createMockChunk(
      'IHDR',
      Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
    ),
    createMockChunk('IDAT', idatData),
    createMockChunk('IEND', new Uint8Array(0))
  )
}

function createMockChunk(type, data) {
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, data.length)
  chunk.set(
    Uint8Array.from(String(type).split('').map((char) => char.charCodeAt(0))),
    4
  )
  chunk.set(data, 8)
  return chunk
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0

  parts.forEach((part) => {
    merged.set(part, offset)
    offset += part.length
  })

  return merged
}

function readChunkTypes(bytes) {
  const types = []
  let offset = 8

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    types.push(type)
    offset += 12 + length
    if (type === 'IEND') break
  }

  return types
}

function readChunkData(bytes, targetType) {
  let offset = 8

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    const data = bytes.slice(offset + 8, offset + 8 + length)
    if (type === targetType) return data
    offset += 12 + length
  }

  return null
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset
  )
}
