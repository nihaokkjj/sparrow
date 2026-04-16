const CONTINUOUS_LEGEND_TYPES = new Set([
  'linear',
  'log',
  'time',
  'threshold',
  'quantile',
  'quantize'
])

export function planGuideLayout(scales, dimensions, options = {}) {
  const { x: xScale, y: yScale, color: colorScale } = scales
  const { x = {}, y = {}, color = {} } = options
  const { display: dx = true } = x
  const { display: dy = true } = y
  const { display: dc = true } = color
  const padding = { top: 0, right: 0, bottom: 0, left: 0 }

  if (dx && xScale) {
    reserveAxisPadding(padding, 'x', merge(x, xScale), dimensions)
  }

  if (dy && yScale) {
    reserveAxisPadding(padding, 'y', merge(y, yScale), dimensions)
  }

  if (dc && colorScale) {
    reserveLegendPadding(padding, merge(color, colorScale), colorScale)
  }

  return padding
}

export function inferGuides(scales, dimensions, options, aiOptions = {}) {
  const guides = createGuideDescriptors(scales, dimensions, options)
  const hasExplicitColorCoordinates =
    Number.isFinite(options?.color?.x) || Number.isFinite(options?.color?.y)

  // renderPlotSpec() is synchronous, so any guide optimization must stay
  // rule-based here instead of returning a Promise.
  if (aiOptions.enabled && guides.color && !hasExplicitColorCoordinates) {
    return optimizeLegendLayout(guides, dimensions)
  }

  return guides
}

function createGuideDescriptors(scales, dimensions, options = {}) {
  const { x: xScale, y: yScale, color: colorScale } = scales
  const { x = {}, y = {}, color = {} } = options
  const { display: dx = true } = x
  const { display: dy = true } = y
  const { display: dc = true } = color

  return {
    ...(dx &&
      xScale && {
        x: {
          ...merge(x, xScale),
          position: inferAxisPosition('x', x.position, dimensions),
          type: 'axisX'
        }
      }),
    ...(dy &&
      yScale && {
        y: {
          ...merge(y, yScale),
          position: inferAxisPosition('y', y.position, dimensions),
          type: 'axisY'
        }
      }),
    ...(dc &&
      colorScale && {
        color: createLegendDescriptor(color, colorScale, dimensions)
      })
  }
}

function createLegendDescriptor(options, colorScale, dimensions) {
  const type = inferLegendType(colorScale)
  const position = normalizeLegendPosition(options.position)
  const orientation = inferLegendOrientation(position, options.orientation, type)

  return {
    ...merge(options, colorScale),
    ...(orientation && { orientation }),
    ...inferLegendPosition(dimensions, options, colorScale, {
      position,
      type,
      orientation
    }),
    type
  }
}

function optimizeLegendLayout(guides, dimensions) {
  const { color } = guides

  if (!color) return guides

  const estimatedSize = color.estimatedSize || estimateLegendSizeForGuide(color)
  if (legendFitsPlacement(color, dimensions, estimatedSize)) {
    return guides
  }

  const orientationFix = switchLegendOrientation(guides, dimensions)
  if (orientationFix) return orientationFix

  for (const position of nextLegendPositions(color.position)) {
    const nextColor = {
      ...color,
      position,
      ...baseLegendPosition(position, dimensions, estimatedSize),
      estimatedSize
    }

    if (legendFitsPlacement(nextColor, dimensions, estimatedSize)) {
      return {
        ...guides,
        color: nextColor
      }
    }
  }

  return guides
}

function switchLegendOrientation(guides, dimensions) {
  const { color } = guides
  if (!color || color.type !== 'legendSwatches') return null

  const verticalSize = estimateVerticalLegendSize(color.domain)

  for (const position of ['right', 'left']) {
    const nextColor = {
      ...color,
      position,
      orientation: 'vertical',
      ...baseLegendPosition(position, dimensions, verticalSize),
      estimatedSize: verticalSize
    }

    if (legendFitsPlacement(nextColor, dimensions, verticalSize)) {
      return {
        ...guides,
        color: nextColor
      }
    }
  }

  return null
}

function nextLegendPositions(currentPosition) {
  return ['right', 'left', 'top', 'bottom'].filter(
    (position) => position !== currentPosition
  )
}

function merge(options, { domain, label }) {
  return { domain, label, ...options }
}

function reserveAxisPadding(padding, axis, options, dimensions) {
  const position = inferAxisPosition(axis, options.position, dimensions)
  if (!isSide(position)) return

  addPadding(padding, position, estimateAxisThickness(axis, options))
}

function reserveLegendPadding(padding, options, colorScale) {
  if (Number.isFinite(options.x) || Number.isFinite(options.y)) {
    return
  }

  const position = normalizeLegendPosition(options.position)
  const type = inferLegendType(colorScale)
  const orientation = inferLegendOrientation(position, options.orientation, type)
  const { width, height } = estimateLegendSize(type, colorScale, {
    ...options,
    orientation
  })
  const offset = options.offset ?? 24
  const reserved =
    position === 'left' || position === 'right' ? width + offset : height + offset

  addPadding(padding, position, reserved)
}

function addPadding(padding, side, amount) {
  padding[side] += Math.max(0, Math.ceil(amount))
}

function inferLegendType({ type }) {
  return CONTINUOUS_LEGEND_TYPES.has(type) ? 'legendRamp' : 'legendSwatches'
}

function inferAxisPosition(axis, position, { isPolar = false, isTranspose = false }) {
  if (isPolar) {
    return axis === 'x' ? 'angular' : 'radial'
  }

  if (axis === 'x') {
    return isTranspose ? normalizeVertical(position, 'left') : normalizeHorizontal(position, 'bottom')
  }

  return isTranspose ? normalizeHorizontal(position, 'top') : normalizeVertical(position, 'left')
}

function inferLegendPosition(
  { frameX, frameY, frameWidth, frameHeight, outerWidth, outerHeight },
  options,
  colorScale,
  {
    position = normalizeLegendPosition(options.position),
    type = inferLegendType(colorScale),
    orientation = inferLegendOrientation(
      position,
      options.orientation,
      type
    )
  } = {}
) {
  const offset = options.offset ?? 24

  const estimatedSize = estimateLegendSize(type, colorScale, {
    ...options,
    orientation
  })

  const defaults = baseLegendPosition(
    position,
    {
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      outerWidth,
      outerHeight,
      offset
    },
    estimatedSize
  )

  if (Number.isFinite(options.x) || Number.isFinite(options.y)) {
    return {
      position,
      x: Number.isFinite(options.x) ? options.x : defaults.x,
      y: Number.isFinite(options.y) ? options.y : defaults.y,
      estimatedSize
    }
  }

  return {
    position,
    ...defaults,
    estimatedSize
  }
}

function estimateLegendSizeForGuide(guide) {
  return estimateLegendSize(guide.type, guide, guide)
}

function estimateVerticalLegendSize(domain) {
  return estimateSwatchLegendSize(domain, { orientation: 'vertical' })
}

function legendFitsPlacement(
  guide,
  { frameX, frameY, frameWidth, frameHeight, outerWidth, outerHeight },
  size
) {
  const { x = 0, y = 0, position } = guide
  const { width, height } = size
  const withinCanvas =
    x >= 0 && y >= 0 && x + width <= outerWidth && y + height <= outerHeight

  if (!withinCanvas) return false

  switch (position) {
    case 'left':
      return x + width <= frameX
    case 'right':
      return x >= frameX + frameWidth
    case 'top':
      return y + height <= frameY
    case 'bottom':
      return y >= frameY + frameHeight
    default:
      return true
  }
}

function baseLegendPosition(
  position,
  {
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    outerWidth,
    outerHeight,
    offset = 24
  },
  size = { width: 0, height: 0 }
) {
  const width = size.width ?? 0
  const height = size.height ?? 0

  switch (position) {
    case 'top':
      return {
        x: clamp(frameX, 0, outerWidth - width),
        y: clamp(frameY - offset - height, 0, outerHeight - height)
      }
    case 'bottom':
      return {
        x: clamp(frameX, 0, outerWidth - width),
        y: clamp(frameY + frameHeight + offset, 0, outerHeight - height)
      }
    case 'left':
      return {
        x: clamp(frameX - offset - width, 0, outerWidth - width),
        y: clamp(frameY, 0, outerHeight - height)
      }
    case 'right':
    default:
      return {
        x: clamp(frameX + frameWidth + offset, 0, outerWidth - width),
        y: clamp(frameY, 0, outerHeight - height)
      }
  }
}

function clamp(value, min, max) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function isSide(position) {
  return (
    position === 'top' ||
    position === 'right' ||
    position === 'bottom' ||
    position === 'left'
  )
}

function estimateAxisThickness(axis, options = {}) {
  const tickLength = options.tickLength ?? 5
  const fontSize = options.fontSize ?? 12
  const label = options.label

  if (axis === 'x') {
    const tickTextHeight = fontSize * 1.6
    const labelHeight = label ? fontSize * 1.8 : 0
    return tickLength + tickTextHeight + labelHeight
  }

  const tickLabels = estimateAxisTickLabels(options)
  const tickWidth = estimateMaxTextWidth(tickLabels, fontSize) + fontSize
  const labelWidth = label ? estimateTextWidth(label, fontSize) + fontSize : 0
  return tickLength + Math.max(tickWidth, labelWidth)
}

function estimateAxisTickLabels({ domain, type, formatter }) {
  const values = sampleAxisTicks(domain, type)
  return values.map((value) => formatText(applyFormatter(formatter, value)))
}

function sampleAxisTicks(domain, type) {
  if (!Array.isArray(domain) || domain.length === 0) return []

  if (type === 'linear' || type === 'log' || type === 'quantize') {
    const [start, end] = domain
    if (!Number.isFinite(start) || !Number.isFinite(end)) return domain
    if (start === end) return [start]
    return uniqueValues([start, (start + end) / 2, end])
  }

  if (type === 'time') {
    const [start, end] = domain
    const startTime = +new Date(start)
    const endTime = +new Date(end)
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return domain
    if (startTime === endTime) return [new Date(startTime)]
    return [
      new Date(startTime),
      new Date((startTime + endTime) / 2),
      new Date(endTime)
    ]
  }

  return domain
}

function estimateLegendSize(type, colorScale, options = {}) {
  if (type === 'legendRamp') {
    return estimateRampLegendSize(options)
  }

  return estimateSwatchLegendSize(colorScale?.domain, options)
}

function estimateRampLegendSize(options = {}) {
  const width = options.width ?? 120
  const height = options.height ?? 10
  const fontSize = options.fontSize ?? 10
  const tickLength = options.tickLength ?? height + 5
  const labelHeight = options.label ? fontSize * 2 : 0

  return {
    width,
    height: Math.ceil(labelHeight + height + tickLength + fontSize * 1.2)
  }
}

function estimateSwatchLegendSize(domain, options = {}) {
  const values = Array.isArray(domain) && domain.length > 0 ? domain : ['']
  const orientation = options.orientation ?? 'horizontal'
  const fontSize = options.fontSize ?? 10
  const swatchSize = options.swatchSize ?? 10
  const labels = values.map((value) =>
    formatText(applyFormatter(options.formatter, value))
  )
  const maxLabelWidth = estimateMaxTextWidth(labels, fontSize)
  const labelWidth = options.label ? estimateTextWidth(options.label, fontSize) : 0
  const labelHeight = options.label ? swatchSize * 2 : 0

  if (orientation === 'vertical') {
    const itemGap = 20
    return {
      width: Math.ceil(
        Math.max(labelWidth, swatchSize + 6 + maxLabelWidth, swatchSize * 4)
      ),
      height: Math.ceil(
        labelHeight +
          values.length * swatchSize +
          Math.max(values.length - 1, 0) * itemGap
      )
    }
  }

  const itemWidth = Math.max(options.width ?? 48, swatchSize + 12)
  const totalWidth = labels.reduce(
    (sum, label) =>
      sum + Math.max(itemWidth, swatchSize + 12 + estimateTextWidth(label, fontSize)),
    0
  )

  return {
    width: Math.ceil(Math.max(totalWidth, labelWidth)),
    height: Math.ceil(labelHeight + Math.max(swatchSize, fontSize) + fontSize * 1.4)
  }
}

function inferLegendOrientation(position, orientation, type) {
  if (orientation) return orientation
  if (type !== 'legendSwatches') return undefined
  return position === 'left' || position === 'right' ? 'vertical' : 'horizontal'
}

function estimateMaxTextWidth(values, fontSize) {
  return values.reduce(
    (max, value) => Math.max(max, estimateTextWidth(value, fontSize)),
    0
  )
}

function estimateTextWidth(value, fontSize) {
  return formatText(value).length * fontSize * 0.6
}

function applyFormatter(formatter, value) {
  return typeof formatter === 'function' ? formatter(value) : value
}

function formatText(value) {
  return value == null ? '' : String(value)
}

function uniqueValues(values) {
  return Array.from(new Set(values))
}

function normalizeHorizontal(position, fallback) {
  return position === 'top' || position === 'bottom' ? position : fallback
}

function normalizeVertical(position, fallback) {
  return position === 'left' || position === 'right' ? position : fallback
}

function normalizeLegendPosition(position) {
  switch (position) {
    case 'top':
    case 'right':
    case 'bottom':
    case 'left':
      return position
    default:
      return 'right'
  }
}
