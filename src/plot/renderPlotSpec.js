import { createRenderer } from '../renderer/renderer.js'
import { createCoordinate } from '../coordinate/coordinate.js'
import { create } from './create.js'
import { initialize } from './encoding.js'
import { inferGuides } from './guide.js'
import { inferScales, applyScales } from './plot.js'

const SUPPORTED_TYPES = new Set(['point', 'line', 'interval'])

const DEFAULT_SIZE = {
  width: 640,
  height: 480
}

const DEFAULT_PADDING = {
  top: 24,
  right: 96,
  bottom: 48,
  left: 56
}

export function renderPlotSpec(input, options = {}) {
  const spec = normalizeSpec(input, options)
  const renderer = options.renderer || createRenderer(spec.width, spec.height)
  const plot = initialize(spec.plot)
  const scaleOptions = normalizeScaleOptions(spec.scales, plot, spec.plot)
  const scaleDescriptors = inferScales([plot.channels], scaleOptions)
  const scales = Object.fromEntries(
    Object.entries(scaleDescriptors).map(([name, descriptor]) => [
      name,
      create(descriptor)
    ])
  )

  const coordinate = createCoordinate({
    ...spec.plotArea,
    transforms: spec.coordinate.transforms
  })

  const values = applyScales(plot.channels, scales)
  const marks = plot.geometry(
    renderer,
    plot.index,
    scales,
    values,
    plot.styles,
    coordinate
  )

  const guideDescriptors = inferGuides(
    scaleDescriptors,
    {
      x: spec.plotArea.width,
      y: spec.plotArea.y,
      paddingLeft: spec.plotArea.x
    },
    spec.guides
  )

  for (const [name, descriptor] of Object.entries(guideDescriptors)) {
    const guide = create(descriptor)
    guide(renderer, scales[name], coordinate)
  }

  const node = renderer.node()
  mountNode(node, spec.container, spec.clear)

  return {
    renderer,
    node,
    marks,
    scales,
    scaleDescriptors,
    guideDescriptors,
    coordinate,
    plot: {
      ...plot,
      values
    }
  }
}

function normalizeSpec(input, options) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('renderPlotSpec expects a plot spec object.')
  }

  if (Array.isArray(input.plots) && input.plots.length !== 1) {
    throw new Error('renderPlotSpec only supports a single plot.')
  }

  const width = options.width ?? input.width ?? DEFAULT_SIZE.width
  const height = options.height ?? input.height ?? DEFAULT_SIZE.height
  const padding = normalizePadding(input.padding)
  const plotArea = {
    x: padding.left,
    y: padding.top,
    width: width - padding.left - padding.right,
    height: height - padding.top - padding.bottom
  }

  if (plotArea.width <= 0 || plotArea.height <= 0) {
    throw new Error('renderPlotSpec requires a positive plot area.')
  }

  return {
    width,
    height,
    clear: options.clear ?? true,
    container: options.container ?? input.container,
    plotArea,
    coordinate: normalizeCoordinate(input.coordinate),
    guides: normalizeGuideOptions(input.guides),
    scales: normalizeOptions(input.scales),
    plot: normalizePlot(input.plot || input.plots?.[0] || input)
  }
}

function normalizePlot(plot) {
  const {
    data,
    type,
    encodings = {},
    statistics = [],
    transforms = [],
    styles = {}
  } = plot || {}

  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error(
      `renderPlotSpec only supports point, line, and interval marks. Received "${type}".`
    )
  }

  if (!Array.isArray(data)) {
    throw new Error('renderPlotSpec requires plot.data to be an array.')
  }

  return {
    data,
    type,
    encodings,
    statistics,
    transforms,
    styles
  }
}

function normalizePadding(padding) {
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    }
  }

  return {
    top: padding?.top ?? DEFAULT_PADDING.top,
    right: padding?.right ?? DEFAULT_PADDING.right,
    bottom: padding?.bottom ?? DEFAULT_PADDING.bottom,
    left: padding?.left ?? DEFAULT_PADDING.left
  }
}

function normalizeCoordinate(coordinate = {}) {
  if (typeof coordinate === 'string') {
    coordinate = { type: coordinate }
  }

  if (Array.isArray(coordinate?.transforms)) {
    return {
      transforms: coordinate.transforms.map((transform) =>
        normalizeTransform(transform)
      )
    }
  }

  const { type = 'cartesian', ...rest } = coordinate

  switch (type) {
    case 'cartesian':
      return { transforms: [create({ type: 'cartesian', ...rest })] }
    case 'transpose':
      return {
        transforms: [
          create({ type: 'transpose', ...rest }),
          create({ type: 'cartesian' })
        ]
      }
    case 'polar':
      return {
        transforms: [create({ type: 'polar', ...rest }), create({ type: 'cartesian' })]
      }
    default:
      throw new Error(`Unsupported coordinate type: ${type}`)
  }
}

function normalizeTransform(transform) {
  if (typeof transform === 'function') return transform
  if (typeof transform === 'string') return create({ type: transform })
  if (transform && typeof transform === 'object') return create(transform)
  throw new Error('Coordinate transforms must be functions, strings, or objects.')
}

function normalizeGuideOptions(guides) {
  if (guides === false) {
    return {
      x: { display: false },
      y: { display: false },
      color: { display: false }
    }
  }

  if (!guides || guides === true) return {}

  return {
    ...(guides.x !== undefined && { x: normalizeGuideOption(guides.x) }),
    ...(guides.y !== undefined && { y: normalizeGuideOption(guides.y) }),
    ...(guides.color !== undefined && {
      color: normalizeGuideOption(guides.color)
    })
  }
}

function normalizeGuideOption(option) {
  if (option === false) return { display: false }
  if (option === true) return { display: true }
  return { ...option }
}

function normalizeScaleOptions(scales, plot, plotSpec) {
  const options = normalizeOptions(scales)

  if (plotSpec.type === 'interval' && !plot.channels.x1 && !options.x?.type) {
    options.x = { ...options.x, type: 'band' }
  }

  return options
}

function normalizeOptions(options) {
  return Object.fromEntries(
    Object.entries(options || {}).map(([key, value]) => [key, { ...value }])
  )
}

function mountNode(node, container, clear) {
  const target = resolveContainer(container)
  if (!target) return

  if (clear) target.replaceChildren(node)
  else target.appendChild(node)
}

function resolveContainer(container) {
  if (!container) return null
  if (typeof container !== 'string') return container
  if (typeof document === 'undefined') return null

  const target = document.querySelector(container)
  if (!target) throw new Error(`Container not found: ${container}`)
  return target
}
