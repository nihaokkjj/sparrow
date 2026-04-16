import { createRenderer } from '../renderer/renderer.js'
import { createCoordinate } from '../coordinate/coordinate.js'
import { createPlotAnimationPlayer, normalizeAnimation } from './animation.js'
import { create } from './create.js'
import { initialize } from './encoding.js'
import { inferGuides } from './guide.js'
import { inferScales, applyScales } from './plot.js'

const SUPPORTED_TYPES = new Set([
  'point',
  'line',
  'interval',
  'pie',
  'area',
  'rect',
  'cell',
  'text'
])

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
  const plots = spec.plots.map(initialize)
  const scaleOptions = normalizeScaleOptions(spec.scales, plots, spec.plots)
  const scaleDescriptors = inferScales(
    plots.map((plot) => plot.channels),
    scaleOptions
  )
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

  const renderedPlots = plots.map((plot, index) => {
    const values = applyScales(plot.channels, scales)
    const marks = plot.geometry(
      renderer,
      plot.index,
      scales,
      values,
      plot.styles,
      coordinate
    )

    return {
      ...spec.plots[index],
      ...plot,
      values,
      marks,
      coordinate
    }
  })

  const marks = renderedPlots.flatMap((plot) => plot.marks)
  const animationPlayers = renderedPlots.map((plot) =>
    createPlotAnimationPlayer(renderer, plot, plot.marks)
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

  const playAnimations = () =>
    animationPlayers.flatMap((player) => player.play())
  const stopAnimations = () =>
    animationPlayers.forEach((player) => player.stop())

  if (options.autoplay !== false && node.isConnected) {
    playAnimations()
  }

  return {
    renderer,
    node,
    marks,
    scales,
    scaleDescriptors,
    guideDescriptors,
    coordinate,
    playAnimations,
    stopAnimations,
    plot: renderedPlots[0],
    plots: renderedPlots
  }
}

function normalizeSpec(input, options) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('renderPlotSpec expects a plot spec object.')
  }

  const width =
    options.width ?? input.width ?? options.frame?.width ?? DEFAULT_SIZE.width
  const height =
    options.height ??
    input.height ??
    options.frame?.height ??
    DEFAULT_SIZE.height
  const frame = normalizeFrame(options.frame ?? input.frame, width, height)
  const padding = normalizePadding(input.padding)
  const plotArea = {
    x: frame.x + padding.left,
    y: frame.y + padding.top,
    width: frame.width - padding.left - padding.right,
    height: frame.height - padding.top - padding.bottom
  }

  if (plotArea.width <= 0 || plotArea.height <= 0) {
    throw new Error('renderPlotSpec requires a positive plot area.')
  }

  const plots = normalizePlots(input)
  const hasPiePlot = plots.some((plot) => plot.type === 'pie')

  return {
    width: Math.max(width, frame.x + frame.width),
    height: Math.max(height, frame.y + frame.height),
    clear: options.clear ?? true,
    container: options.container ?? input.container,
    plotArea,
    coordinate: normalizeCoordinate(input.coordinate, { hasPiePlot }),
    guides: normalizeGuideOptions(input.guides),
    scales: normalizeOptions(input.scales),
    plots
  }
}

function normalizePlots(input) {
  const defaultData = Array.isArray(input.data) ? input.data : undefined
  const defaultAnimation = input.animation
  const plots = Array.isArray(input.plots)
    ? input.plots
    : Array.isArray(input.plot)
      ? input.plot
      : [input.plot || input]

  if (plots.length === 0) {
    throw new Error('renderPlotSpec requires at least one plot.')
  }

  return plots.map((plot) =>
    normalizePlot(plot, defaultData, defaultAnimation)
  )
}

function normalizePlot(plot, defaultData, defaultAnimation) {
  const {
    data = defaultData,
    type,
    encodings = {},
    statistics = [],
    transforms = [],
    styles = {},
    animation = defaultAnimation
  } = plot || {}

  const normalizedEncodings =
    type === 'pie' ? normalizePieEncodings(encodings) : encodings

  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error(
      `renderPlotSpec only supports point, line, interval, pie, area, rect, cell, and text marks. Received "${type}".`
    )
  }

  if (!Array.isArray(data)) {
    throw new Error('renderPlotSpec requires plot.data to be an array.')
  }

  return {
    data,
    type,
    encodings: normalizedEncodings,
    statistics,
    transforms,
    styles,
    animation: normalizeAnimation(animation)
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

function normalizeFrame(frame, width, height) {
  if (!frame) {
    return {
      x: 0,
      y: 0,
      width,
      height
    }
  }

  return {
    x: frame.x ?? 0,
    y: frame.y ?? 0,
    width: frame.width ?? width,
    height: frame.height ?? height
  }
}

function normalizeCoordinate(coordinate, { hasPiePlot = false } = {}) {
  if (coordinate === undefined && hasPiePlot) {
    coordinate = { type: 'polar' }
  }

  if (coordinate === undefined) {
    coordinate = {}
  }

  if (Array.isArray(coordinate)) {
    return {
      transforms: coordinate.map((transform) => normalizeTransform(transform))
    }
  }

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
        transforms: [
          create({ type: 'polar', ...rest }),
          create({ type: 'cartesian' })
        ]
      }
    default:
      throw new Error(`Unsupported coordinate type: ${type}`)
  }
}

function normalizePieEncodings(encodings = {}) {
  const {
    angle,
    value,
    theta,
    radius,
    r,
    innerRadius,
    outerRadius,
    ...rest
  } = encodings

  return {
    ...rest,
    ...(angle !== undefined
      ? { angle }
      : value !== undefined
        ? { angle: value }
        : theta !== undefined
          ? { angle: theta }
          : {}),
    ...(innerRadius !== undefined ? { innerRadius } : {}),
    ...(outerRadius !== undefined
      ? { outerRadius }
      : radius !== undefined
        ? { outerRadius: radius }
        : r !== undefined
          ? { outerRadius: r }
          : {})
  }
}

function normalizeTransform(transform) {
  if (typeof transform === 'function') return transform
  if (typeof transform === 'string') return create({ type: transform })
  if (transform && typeof transform === 'object') return create(transform)
  throw new Error(
    'Coordinate transforms must be functions, strings, or objects.'
  )
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

function normalizeScaleOptions(scales, plots, plotSpecs) {
  const options = normalizeOptions(scales)

  for (let index = 0; index < plotSpecs.length; index += 1) {
    const plot = plots[index]
    const plotSpec = plotSpecs[index]
    if (plotSpec.type === 'interval' && !plot.channels.x1 && !options.x?.type) {
      options.x = { ...options.x, type: 'band' }
    }
    if (plotSpec.type === 'cell') {
      if (!options.x?.type) options.x = { ...options.x, type: 'band' }
      if (!options.y?.type) options.y = { ...options.y, type: 'band' }
    }
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
