export function inferGuides(scales, dimensions, options, aiOptions = {}) {
  const { x: xScale, y: yScale, color: colorScale } = scales
  const { x = {}, y = {}, color = {} } = options
  const { display: dx = true } = x
  const { display: dy = true } = y
  const { display: dc = true } = color
  const hasExplicitColorCoordinates =
    Number.isFinite(color.x) || Number.isFinite(color.y)

  const guides = {
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
        color: {
          ...merge(color, colorScale),
          ...inferLegendPosition(dimensions, color, colorScale),
          type: inferLegendType(colorScale)
        }
      })
  }

  // renderPlotSpec() is synchronous, so any guide optimization must stay
  // rule-based here instead of returning a Promise.
  if (aiOptions.enabled && guides.color && !hasExplicitColorCoordinates) {
    return optimizeLegendLayout(guides, dimensions)
  }

  return guides
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

function inferLegendType({ type }) {
  switch (type) {
    case 'linear':
    case 'log':
    case 'time':
    case 'threshold':
    case 'quantile':
    case 'quantize':
      return 'legendRamp'
    default:
      return 'legendSwatches'
  }
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
  colorScale
) {
  const position = normalizeLegendPosition(options.position)
  const offset = options.offset ?? 24

  const estimatedSize = colorScale
    ? estimateLegendSizeForScale(colorScale)
    : { width: 100, height: 150 }

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

function estimateLegendSizeForScale(colorScale) {
  if (!colorScale) return { width: 100, height: 150 }

  const continuousTypes = ['linear', 'log', 'time', 'threshold', 'quantile', 'quantize']
  if (continuousTypes.includes(colorScale.type)) {
    return { width: 120, height: 200 }
  }

  const domain = colorScale.domain
  const categoryCount = Array.isArray(domain) ? domain.length : 4
  return { width: categoryCount * 60, height: categoryCount * 20 + 40 }
}

function estimateLegendSizeForGuide(guide) {
  if (guide.type === 'legendRamp') {
    return {
      width: guide.width ?? 120,
      height: guide.height ?? 200
    }
  }

  return {
    width: guide.estimatedSize?.width ?? 100,
    height: guide.estimatedSize?.height ?? 150
  }
}

function estimateVerticalLegendSize(domain) {
  const categoryCount = Array.isArray(domain) ? domain.length : 4
  return {
    width: 60,
    height: categoryCount * 18 + 40
  }
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
