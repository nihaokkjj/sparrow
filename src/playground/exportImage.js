import { renderAISpec } from '../plot/renderAISpec.js'

const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_FILENAME = 'sparrow-chart.png'
const DEFAULT_SCALE = 2

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

  const svgText = serializeSVG(svg, dimensions)
  const svgURL = createObjectURL(
    new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  )

  try {
    const image = createImage()
    await loadImage(image, svgURL)

    const canvas = createCanvas()
    const pixelWidth = Math.max(1, Math.round(dimensions.width * scale))
    const pixelHeight = Math.max(1, Math.round(dimensions.height * scale))
    canvas.width = pixelWidth
    canvas.height = pixelHeight

    const context = canvas.getContext?.('2d')
    if (!context) {
      throw new Error('PNG export requires a 2D canvas context.')
    }

    if (background) {
      context.fillStyle = background
      context.fillRect(0, 0, pixelWidth, pixelHeight)
    }

    if (scale !== 1) {
      context.scale(scale, scale)
    }
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height)

    const pngBlob = await canvasToBlob(canvas, 'image/png')
    const pngURL = createObjectURL(pngBlob)

    try {
      downloadURL(pngURL, filename, createAnchor)
    } finally {
      revokeObjectURL(pngURL)
    }
  } finally {
    revokeObjectURL(svgURL)
  }
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
