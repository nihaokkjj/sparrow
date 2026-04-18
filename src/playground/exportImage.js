import { renderAISpec } from '../plot/renderAISpec.js'

const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_FILENAME = 'sparrow-chart.png'
const DEFAULT_APNG_FILENAME = 'sparrow-chart.apng'
const DEFAULT_SCALE = 2
const DEFAULT_APNG_FPS = 20
const DEFAULT_APNG_PLAYS = 1
const DEFAULT_APNG_SETTLE_DELAY = 80
const DEFAULT_SINGLE_FRAME_DELAY = 1000
const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
const PNG_MIME_TYPE = 'image/png'
const SVG_MIME_TYPE = 'image/svg+xml;charset=utf-8'
const APNG_MIME_TYPE = 'image/apng'

export async function exportSpecAsPNG(spec, options = {}) {
  const {
    background = DEFAULT_BACKGROUND,
    filename = DEFAULT_FILENAME,
    height,
    autoLayout,
    render = renderAISpec,
    scale = DEFAULT_SCALE,
    width,
    createAnchor = createDefaultAnchor,
    createCanvas = createDefaultCanvas,
    createImage = createDefaultImage,
    createObjectURL = createDefaultObjectURL,
    revokeObjectURL = revokeDefaultObjectURL
  } = options

  const exportSpec = createExportSpec(spec, { width, height })
  const dimensions = getExportDimensions(exportSpec, { width, height })
  const result = render(exportSpec, {
    autoLayout,
    autoplay: false,
    width: dimensions.width,
    height: dimensions.height
  })
  const svg = result?.node

  if (!svg || svg.tagName?.toLowerCase() !== 'svg') {
    throw new Error('PNG export requires renderAISpec() to return an SVG node.')
  }

  const canvas = createCanvas()
  await renderSVGToCanvas(svg, dimensions, {
    background,
    canvas,
    createImage,
    createObjectURL,
    revokeObjectURL,
    scale
  })

  const pngBlob = await canvasToBlob(canvas, PNG_MIME_TYPE)
  const pngURL = createObjectURL(pngBlob)

  try {
    downloadURL(pngURL, filename, createAnchor)
  } finally {
    revokeObjectURL(pngURL)
  }
}

export async function exportSpecAsAPNG(spec, options = {}) {
  const {
    autoLayout,
    background = DEFAULT_BACKGROUND,
    createAnchor = createDefaultAnchor,
    createCanvas = createDefaultCanvas,
    createImage = createDefaultImage,
    createObjectURL = createDefaultObjectURL,
    filename = DEFAULT_APNG_FILENAME,
    fps = DEFAULT_APNG_FPS,
    height,
    maxDuration,
    now = () => performance.now(),
    plays = DEFAULT_APNG_PLAYS,
    render = renderAISpec,
    revokeObjectURL = revokeDefaultObjectURL,
    scale = DEFAULT_SCALE,
    settleDelay = DEFAULT_APNG_SETTLE_DELAY,
    waitUntil = waitUntilTimestamp,
    width
  } = options

  const exportSpec = createExportSpec(spec, { width, height })
  const dimensions = getExportDimensions(exportSpec, { width, height })
  const result = render(exportSpec, {
    autoLayout,
    autoplay: false,
    width: dimensions.width,
    height: dimensions.height
  })
  const svg = result?.node

  if (!svg || svg.tagName?.toLowerCase() !== 'svg') {
    throw new Error('APNG export requires renderAISpec() to return an SVG node.')
  }

  const totalDuration = normalizeAPNGDuration(
    maxDuration,
    estimateAnimationDuration(result)
  )
  const frameDelay = normalizeFrameDelay(fps)
  const captureTimes = createCaptureSchedule(
    totalDuration,
    frameDelay,
    settleDelay
  )
  const frameDelays = createFrameDelays(captureTimes, frameDelay)
  const canvas = createCanvas()
  const framePNGs = []
  const playAnimations =
    typeof result?.playAnimations === 'function'
      ? () => result.playAnimations()
      : null
  const stopAnimations =
    typeof result?.stopAnimations === 'function'
      ? () => result.stopAnimations()
      : null

  let startedAt = now()

  try {
    if (playAnimations && totalDuration > 0) {
      playAnimations()
      startedAt = now()
    }

    for (const elapsed of captureTimes) {
      if (elapsed > 0) {
        await waitUntil(startedAt + elapsed, { now })
      }

      framePNGs.push(
        await captureCanvasPNGBytes(svg, dimensions, {
          background,
          canvas,
          createImage,
          createObjectURL,
          revokeObjectURL,
          scale
        })
      )
    }
  } finally {
    stopAnimations?.()
  }

  const apngBytes = assembleAPNG(framePNGs, frameDelays, { plays })
  const apngURL = createObjectURL(
    new Blob([apngBytes], { type: APNG_MIME_TYPE })
  )

  try {
    downloadURL(apngURL, filename, createAnchor)
  } finally {
    revokeObjectURL(apngURL)
  }
}

export function estimateAnimationDuration(renderResult) {
  const plots = Array.isArray(renderResult?.plots) ? renderResult.plots : []

  return plots.reduce((maxDuration, plot) => {
    const enter = plot?.animation?.enter
    if (!enter) return maxDuration

    const delay = finiteNonNegativeNumber(enter.delay, 0)
    const duration = finiteNonNegativeNumber(enter.duration, 0)
    const stagger = finiteNonNegativeNumber(enter.stagger, 0)
    const marks = Array.isArray(plot?.marks) ? plot.marks.length : 0
    const staggerSpan = Math.max(0, marks - 1) * stagger

    return Math.max(maxDuration, delay + duration + staggerSpan)
  }, 0)
}

export function assembleAPNG(
  framePNGs,
  frameDelays,
  { plays = DEFAULT_APNG_PLAYS } = {}
) {
  if (!Array.isArray(framePNGs) || framePNGs.length === 0) {
    throw new Error('APNG export requires at least one PNG frame.')
  }

  const parsedFrames = framePNGs.map((frame, index) =>
    parsePNG(normalizeByteArray(frame), index)
  )
  const header = parsedFrames[0].header

  parsedFrames.forEach((frame) => {
    if (!equalUint8Arrays(frame.header, header)) {
      throw new Error('APNG export requires frames with matching PNG headers.')
    }
  })

  const width = readUint32(header, 0)
  const height = readUint32(header, 4)
  const ancillaryChunks = parsedFrames[0].chunks.filter(
    ({ type }) =>
      !['IHDR', 'IDAT', 'IEND', 'acTL', 'fcTL', 'fdAT'].includes(type)
  )
  const chunkBytes = [PNG_SIGNATURE]
  let sequenceNumber = 0

  chunkBytes.push(createChunk('IHDR', header))
  chunkBytes.push(
    createChunk(
      'acTL',
      concatBytes(
        writeUint32(parsedFrames.length),
        writeUint32(finiteNonNegativeNumber(plays, 0))
      )
    )
  )

  ancillaryChunks.forEach(({ type, data }) => {
    chunkBytes.push(createChunk(type, data))
  })

  parsedFrames.forEach((frame, frameIndex) => {
    chunkBytes.push(
      createChunk(
        'fcTL',
        createFrameControlChunk({
          delay: frameDelays[frameIndex],
          height,
          sequenceNumber: sequenceNumber++,
          width
        })
      )
    )

    frame.idatChunks.forEach((idatChunk) => {
      if (frameIndex === 0) {
        chunkBytes.push(createChunk('IDAT', idatChunk))
        return
      }

      chunkBytes.push(
        createChunk(
          'fdAT',
          concatBytes(writeUint32(sequenceNumber++), idatChunk)
        )
      )
    })
  })

  chunkBytes.push(createChunk('IEND', new Uint8Array(0)))
  return concatBytes(...chunkBytes)
}

export function createExportSpec(spec, { width, height } = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('PNG export requires a rendered SparrowPlotSpec object.')
  }

  return {
    ...cloneJSON(spec),
    ...(Number.isFinite(width) && width > 0 ? { width } : {}),
    ...(Number.isFinite(height) && height > 0 ? { height } : {})
  }
}

export function serializeSVG(svg, { width, height } = {}) {
  const node = svg.cloneNode(true)
  node.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  node.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  if (Number.isFinite(width) && width > 0) {
    node.setAttribute('width', String(width))
  }
  if (Number.isFinite(height) && height > 0) {
    node.setAttribute('height', String(height))
  }
  if (
    !node.getAttribute('viewBox') &&
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0
  ) {
    node.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }

  return new XMLSerializer().serializeToString(node)
}

function getExportDimensions(spec, { width, height } = {}) {
  const fallbackWidth = normalizeDimension(width ?? spec.width, 640)
  const fallbackHeight = normalizeDimension(height ?? spec.height, 480)
  return {
    width: fallbackWidth,
    height: fallbackHeight
  }
}

function normalizeDimension(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

async function captureCanvasPNGBytes(
  svg,
  dimensions,
  {
    background,
    canvas,
    createImage,
    createObjectURL,
    revokeObjectURL,
    scale
  }
) {
  await renderSVGToCanvas(svg, dimensions, {
    background,
    canvas,
    createImage,
    createObjectURL,
    revokeObjectURL,
    scale
  })

  const pngBlob = await canvasToBlob(canvas, PNG_MIME_TYPE)
  return new Uint8Array(await pngBlob.arrayBuffer())
}

async function renderSVGToCanvas(
  svg,
  dimensions,
  {
    background,
    canvas,
    createImage,
    createObjectURL,
    revokeObjectURL,
    scale
  }
) {
  const svgText = serializeSVG(svg, dimensions)
  const svgURL = createObjectURL(new Blob([svgText], { type: SVG_MIME_TYPE }))

  try {
    const image = createImage()
    await loadImage(image, svgURL)

    const pixelWidth = Math.max(1, Math.round(dimensions.width * scale))
    const pixelHeight = Math.max(1, Math.round(dimensions.height * scale))
    canvas.width = pixelWidth
    canvas.height = pixelHeight

    const context = canvas.getContext?.('2d')
    if (!context) {
      throw new Error('PNG export requires a 2D canvas context.')
    }

    if (typeof context.setTransform === 'function') {
      context.setTransform(1, 0, 0, 1, 0, 0)
    }

    if (background) {
      context.fillStyle = background
      context.fillRect(0, 0, pixelWidth, pixelHeight)
    } else if (typeof context.clearRect === 'function') {
      context.clearRect(0, 0, pixelWidth, pixelHeight)
    }

    if (scale !== 1) {
      if (typeof context.setTransform === 'function') {
        context.setTransform(scale, 0, 0, scale, 0, 0)
      } else {
        context.scale(scale, scale)
      }
    }

    context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
    return canvas
  } finally {
    revokeObjectURL(svgURL)
  }
}

function loadImage(image, url) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load SVG for PNG export.'))
    image.src = url
  })
}

function canvasToBlob(canvas, type) {
  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not create PNG image blob.'))
      }, type)
    })
  }

  if (typeof canvas.toDataURL === 'function') {
    return Promise.resolve(dataURLToBlob(canvas.toDataURL(type)))
  }

  throw new Error('PNG export requires canvas.toBlob() or canvas.toDataURL().')
}

function dataURLToBlob(dataURL) {
  const [metadata, data] = dataURL.split(',')
  const contentType =
    metadata.match(/^data:([^;]+);base64$/)?.[1] || 'application/octet-stream'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: contentType })
}

function parsePNG(bytes, index) {
  if (!hasPNGSignature(bytes)) {
    throw new Error(`APNG export expected frame ${index + 1} to be a PNG image.`)
  }

  const chunks = []
  let offset = PNG_SIGNATURE.length

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = readASCII(bytes.subarray(offset + 4, offset + 8))
    const dataStart = offset + 8
    const dataEnd = dataStart + length

    if (dataEnd + 4 > bytes.length) {
      throw new Error(`APNG export found a truncated PNG chunk in frame ${index + 1}.`)
    }

    chunks.push({
      type,
      data: bytes.slice(dataStart, dataEnd)
    })

    offset = dataEnd + 4
    if (type === 'IEND') break
  }

  const headerChunk = chunks.find(({ type }) => type === 'IHDR')
  const idatChunks = chunks
    .filter(({ type }) => type === 'IDAT')
    .map(({ data }) => data)

  if (!headerChunk || headerChunk.data.length !== 13) {
    throw new Error(`APNG export could not find a valid IHDR chunk in frame ${index + 1}.`)
  }

  if (idatChunks.length === 0) {
    throw new Error(`APNG export could not find IDAT data in frame ${index + 1}.`)
  }

  return {
    header: headerChunk.data,
    idatChunks,
    chunks
  }
}

function hasPNGSignature(bytes) {
  return (
    bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  )
}

function normalizeByteArray(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  throw new Error('APNG export requires binary PNG frame data.')
}

function createCaptureSchedule(totalDuration, frameDelay, settleDelay) {
  if (!(totalDuration > 0)) return [0]

  const schedule = [0]
  for (let elapsed = frameDelay; elapsed < totalDuration; elapsed += frameDelay) {
    schedule.push(Math.round(elapsed))
  }

  const finalFrameTime = Math.max(
    schedule[schedule.length - 1],
    Math.round(totalDuration + settleDelay)
  )

  if (finalFrameTime > schedule[schedule.length - 1]) {
    schedule.push(finalFrameTime)
  }

  return schedule
}

function createFrameDelays(captureTimes, frameDelay) {
  if (captureTimes.length === 1) {
    return [DEFAULT_SINGLE_FRAME_DELAY]
  }

  return captureTimes.map((time, index) => {
    const next = captureTimes[index + 1]
    if (next !== undefined) {
      return Math.max(1, Math.round(next - time))
    }

    return Math.max(1, Math.round(frameDelay))
  })
}

function normalizeAPNGDuration(value, fallback) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric >= 0) return numeric
  return Math.max(0, Number(fallback) || 0)
}

function normalizeFrameDelay(fps) {
  const normalizedFPS = Number.isFinite(fps) && fps > 0 ? fps : DEFAULT_APNG_FPS
  return Math.max(1, Math.round(1000 / normalizedFPS))
}

async function waitUntilTimestamp(targetTime, { now = () => performance.now() } = {}) {
  const delay = targetTime - now()
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  await nextFrame()
}

function nextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }

    setTimeout(resolve, 16)
  })
}

function createFrameControlChunk({
  delay,
  height,
  sequenceNumber,
  width
}) {
  const normalizedDelay = Math.max(1, Math.round(delay))
  return concatBytes(
    writeUint32(sequenceNumber),
    writeUint32(width),
    writeUint32(height),
    writeUint32(0),
    writeUint32(0),
    writeUint16(normalizedDelay),
    writeUint16(1000),
    Uint8Array.of(0, 0)
  )
}

function createChunk(type, data) {
  const typeBytes = writeASCII(type)
  const body = normalizeByteArray(data)
  const chunk = new Uint8Array(12 + body.length)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, body.length)
  chunk.set(typeBytes, 4)
  chunk.set(body, 8)
  view.setUint32(8 + body.length, crc32(concatBytes(typeBytes, body)))
  return chunk
}

function crc32(bytes) {
  let value = 0xffffffff

  for (let index = 0; index < bytes.length; index += 1) {
    value = CRC32_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset
  )
}

function writeUint32(value) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0)
  return bytes
}

function writeUint16(value) {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value)
  return bytes
}

function writeASCII(value) {
  return Uint8Array.from(String(value).split('').map((char) => char.charCodeAt(0)))
}

function readASCII(bytes) {
  return String.fromCharCode(...bytes)
}

function concatBytes(...parts) {
  const normalized = parts.map(normalizeByteArray)
  const totalLength = normalized.reduce((sum, part) => sum + part.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0

  normalized.forEach((part) => {
    merged.set(part, offset)
    offset += part.length
  })

  return merged
}

function equalUint8Arrays(left, right) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function finiteNonNegativeNumber(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function downloadURL(url, filename, createAnchor) {
  const anchor = createAnchor()
  anchor.href = url
  anchor.download = filename
  anchor.click()
}

function cloneJSON(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function createDefaultAnchor() {
  return document.createElement('a')
}

function createDefaultCanvas() {
  return document.createElement('canvas')
}

function createDefaultImage() {
  return new Image()
}

function createDefaultObjectURL(value) {
  return URL.createObjectURL(value)
}

function revokeDefaultObjectURL(value) {
  URL.revokeObjectURL(value)
}

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})
