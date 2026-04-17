import { expect, test, vi } from 'vitest'
import {
  createExportSpec,
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
    expect.objectContaining({ autoplay: false, width: 320, height: 240 })
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
