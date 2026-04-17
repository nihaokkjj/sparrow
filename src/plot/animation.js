import { areaPath } from '../geometry/areaPath.js'
import { formatPathData, sectorPath } from '../geometry/sectorPath.js'

const SUPPORTED_ENTER_PRESETS = new Set([
  'fade-in',
  'rise-in',
  'grow-y',
  'pop-in',
  'stagger-rise-in',
  'sweep-in',
  'draw-in'
])

const SUPPORTED_EASES = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut'])

const DEFAULT_ENTER_DURATION = 600
const DEFAULT_ENTER_DELAY = 0
const DEFAULT_ENTER_OFFSET = 16
const DEFAULT_ENTER_STAGGER = 80

export function normalizeAnimation(animation) {
  if (!animation) return null

  if (typeof animation === 'string') {
    animation = { enter: { preset: animation } }
  } else if (
    typeof animation === 'object' &&
    !Array.isArray(animation) &&
    animation.enter === undefined
  ) {
    animation = { enter: animation }
  }

  if (!animation || typeof animation !== 'object' || Array.isArray(animation)) {
    throw new Error('Plot animation must be a string or object.')
  }

  const { enter } = animation
  return {
    ...(enter !== undefined && { enter: normalizeEnterAnimation(enter) })
  }
}

export function createPlotAnimationPlayer(renderer, plot, marks = []) {
  const animation = normalizeAnimation(plot.animation)
  const enter = animation?.enter

  if (!enter || marks.length === 0) {
    return createNoopPlayer()
  }

  const steps = marks
    .map((element, index) => createEnterStep(element, plot, enter, index))
    .filter(Boolean)

  if (steps.length === 0) {
    return createNoopPlayer()
  }

  let started = false
  let timers = []
  let handles = []

  return {
    play() {
      if (started) return handles
      started = true

      steps.forEach((step) => {
        prepareStep(step)

        const start = () => {
          handles.push(playStep(renderer, step))
        }

        if (step.delay > 0) {
          timers.push(setTimeout(start, step.delay))
        } else {
          start()
        }
      })

      return handles
    },
    stop() {
      timers.forEach((timerId) => clearTimeout(timerId))
      handles.forEach((handle) => handle?.stop?.())
      timers = []
      handles = []
    }
  }
}

function createNoopPlayer() {
  return {
    play() {
      return []
    },
    stop() {}
  }
}

function normalizeEnterAnimation(enter) {
  if (typeof enter === 'string') {
    enter = { preset: enter }
  }

  if (!enter || typeof enter !== 'object' || Array.isArray(enter)) {
    throw new Error('Plot animation.enter must be a string or object.')
  }

  const preset = normalizeEnterPreset(enter)
  if (!SUPPORTED_ENTER_PRESETS.has(preset)) {
    throw new Error(
      `Unsupported animation preset: "${preset}". Supported presets are fade-in, rise-in, grow-y, pop-in, stagger-rise-in, sweep-in, and draw-in.`
    )
  }

  return {
    preset,
    duration: finitePositiveNumber(enter.duration, DEFAULT_ENTER_DURATION),
    ease: normalizeEase(enter.ease),
    delay: finiteNonNegativeNumber(enter.delay, DEFAULT_ENTER_DELAY),
    stagger: finiteNonNegativeNumber(
      enter.stagger,
      preset === 'stagger-rise-in' ? DEFAULT_ENTER_STAGGER : 0
    ),
    offset: finiteNonNegativeNumber(enter.offset, DEFAULT_ENTER_OFFSET)
  }
}

function normalizeEnterPreset(enter) {
  const preset = enter.preset ?? enter.type
  return typeof preset === 'string' ? preset.trim() : preset
}

function normalizeEase(value) {
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (SUPPORTED_EASES.has(normalized)) return normalized

    switch (normalized.toLowerCase()) {
      case 'ease-in':
      case 'ease_in':
      case 'easein':
        return 'easeIn'
      case 'ease-out':
      case 'ease_out':
      case 'easeout':
        return 'easeOut'
      case 'ease-in-out':
      case 'ease_in_out':
      case 'easeinout':
        return 'easeInOut'
      default:
        break
    }
  }

  if (SUPPORTED_EASES.has(value)) return value
  return 'easeOut'
}

function createEnterStep(element, plot, enter, index) {
  const delay = enter.delay + enter.stagger * index
  const options = {
    duration: enter.duration,
    ease: enter.ease
  }

  switch (plot.type) {
    case 'interval':
    case 'rect':
    case 'cell':
      if (
        element.tagName === 'path' &&
        enter.preset === 'sweep-in' &&
        plot.coordinate?.isPolar?.()
      ) {
        return createSectorSweepStep(
          element,
          plot.coordinate,
          delay,
          options
        )
      }
      if (element.tagName === 'rect') {
        return createRectStep(element, enter, delay, options)
      }
      return createFadeStep(element, delay, options)
    case 'pie':
      if (
        element.tagName === 'path' &&
        enter.preset === 'sweep-in' &&
        plot.coordinate?.isPolar?.()
      ) {
        return createSectorSweepStep(
          element,
          plot.coordinate,
          delay,
          options
        )
      }
      return createFadeStep(element, delay, options)
    case 'line':
      if (element.tagName === 'path' && enter.preset === 'draw-in') {
        return createPathDrawStep(element, delay, options)
      }
      return createFadeStep(element, delay, options)
    case 'area':
      if (element.tagName === 'path' && enter.preset === 'grow-y') {
        return createAreaGrowStep(element, delay, options)
      }
      return createFadeStep(element, delay, options)
    case 'point':
      if (enter.preset === 'pop-in' && element.tagName === 'circle') {
        return createCirclePopStep(element, delay, options)
      }
      if (
        (enter.preset === 'rise-in' || enter.preset === 'stagger-rise-in') &&
        element.tagName === 'circle'
      ) {
        return createRiseStep(element, 'cy', enter.offset, delay, options)
      }
      return createFadeStep(element, delay, options)
    case 'text':
      if (
        enter.preset === 'rise-in' ||
        enter.preset === 'stagger-rise-in'
      ) {
        return createRiseStep(element, 'y', enter.offset, delay, options)
      }
      return createFadeStep(element, delay, options)
    default:
      return createFadeStep(element, delay, options)
  }
}

function createRectStep(element, enter, delay, options) {
  if (
    enter.preset === 'grow-y' ||
    enter.preset === 'stagger-rise-in'
  ) {
    const y = readNumberAttribute(element, 'y', 0)
    const height = readNumberAttribute(element, 'height', 0)
    return {
      element,
      delay,
      options,
      from: {
        y: y + height,
        height: 0,
        opacity: 0
      },
      to: {
        y,
        height,
        opacity: readNumberAttribute(element, 'opacity', 1)
      }
    }
  }

  if (enter.preset === 'rise-in') {
    return createRiseStep(element, 'y', enter.offset, delay, options)
  }

  return createFadeStep(element, delay, options)
}

function createCirclePopStep(element, delay, options) {
  const radius = readNumberAttribute(element, 'r', 0)
  return {
    element,
    delay,
    options,
    from: {
      r: 0,
      opacity: 0
    },
    to: {
      r: radius,
      opacity: readNumberAttribute(element, 'opacity', 1)
    }
  }
}

function createRiseStep(element, attribute, offset, delay, options) {
  const value = readNumberAttribute(element, attribute, 0)
  return {
    element,
    delay,
    options,
    from: {
      [attribute]: value + offset,
      opacity: 0
    },
    to: {
      [attribute]: value,
      opacity: readNumberAttribute(element, 'opacity', 1)
    }
  }
}

function createFadeStep(element, delay, options) {
  return {
    element,
    delay,
    options,
    from: {
      opacity: 0
    },
    to: {
      opacity: readNumberAttribute(element, 'opacity', 1)
    }
  }
}

function createSectorSweepStep(element, coordinate, delay, options) {
  const start = readNumberAttribute(
    element,
    'data-sparrow-sector-start',
    Number.NaN
  )
  const end = readNumberAttribute(
    element,
    'data-sparrow-sector-end',
    Number.NaN
  )
  const outer = readNumberAttribute(
    element,
    'data-sparrow-sector-outer',
    Number.NaN
  )
  const inner = readNumberAttribute(
    element,
    'data-sparrow-sector-inner',
    Number.NaN
  )

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(outer) ||
    !Number.isFinite(inner)
  ) {
    return createFadeStep(element, delay, options)
  }

  const opacity = readNumberAttribute(element, 'opacity', 1)
  const fromPath = formatPathData(
    sectorPath(coordinate, {
      x: start,
      x1: start,
      y: outer,
      y1: inner
    })
  )
  const toPath = formatPathData(
    sectorPath(coordinate, {
      x: start,
      x1: end,
      y: outer,
      y1: inner
    })
  )

  return {
    element,
    delay,
    options,
    prepare() {
      element.setAttribute('d', fromPath)
      element.setAttribute('opacity', 0)
    },
    play(renderer) {
      return renderer.tween({
        from: 0,
        to: 1,
        duration: options.duration,
        ease: options.ease,
        onUpdate: (progress) => {
          const currentEnd = start + (end - start) * progress
          element.setAttribute(
            'd',
            formatPathData(
              sectorPath(coordinate, {
                x: start,
                x1: currentEnd,
                y: outer,
                y1: inner
              })
            )
          )
          element.setAttribute('opacity', opacity * progress)
        },
        onComplete: () => {
          element.setAttribute('d', toPath)
          element.setAttribute('opacity', opacity)
        }
      })
    }
  }
}

function createPathDrawStep(element, delay, options) {
  const pathLength = readNumberAttribute(
    element,
    'data-sparrow-path-length',
    Number.NaN
  )

  if (!Number.isFinite(pathLength) || pathLength <= 0) {
    return createFadeStep(element, delay, options)
  }

  const opacity = readNumberAttribute(element, 'opacity', 1)
  const originalDasharray = element.getAttribute('stroke-dasharray')
  const originalDashoffset = element.getAttribute('stroke-dashoffset')

  return {
    element,
    delay,
    options,
    prepare() {
      element.setAttribute('stroke-dasharray', pathLength)
      element.setAttribute('stroke-dashoffset', pathLength)
      element.setAttribute('opacity', 0)
    },
    play(renderer) {
      return renderer.animate(
        element,
        {
          'stroke-dashoffset': pathLength,
          opacity: 0
        },
        {
          'stroke-dashoffset': 0,
          opacity
        },
        {
          ...options,
          onComplete: () => {
            restoreOptionalAttribute(
              element,
              'stroke-dasharray',
              originalDasharray
            )
            restoreOptionalAttribute(
              element,
              'stroke-dashoffset',
              originalDashoffset
            )
            element.setAttribute('opacity', opacity)
          }
        }
      )
    }
  }
}

function createAreaGrowStep(element, delay, options) {
  const topPoints = readPointsAttribute(element, 'data-sparrow-area-top')
  const bottomPoints = readPointsAttribute(element, 'data-sparrow-area-bottom')

  if (!topPoints || !bottomPoints || topPoints.length !== bottomPoints.length) {
    return createFadeStep(element, delay, options)
  }

  const opacity = readNumberAttribute(element, 'opacity', 1)
  const fromPath = formatPathData(areaPath(bottomPoints, bottomPoints))
  const toPath = formatPathData(areaPath(topPoints, bottomPoints))

  return {
    element,
    delay,
    options,
    prepare() {
      element.setAttribute('d', fromPath)
      element.setAttribute('opacity', 0)
    },
    play(renderer) {
      return renderer.tween({
        from: 0,
        to: 1,
        duration: options.duration,
        ease: options.ease,
        onUpdate: (progress) => {
          const currentTop = topPoints.map(([x, y], index) => {
            const [, baselineY] = bottomPoints[index]
            return [x, baselineY + (y - baselineY) * progress]
          })

          element.setAttribute('d', formatPathData(areaPath(currentTop, bottomPoints)))
          element.setAttribute('opacity', opacity * progress)
        },
        onComplete: () => {
          element.setAttribute('d', toPath)
          element.setAttribute('opacity', opacity)
        }
      })
    }
  }
}

function applyAttributes(element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value)
  })
}

function prepareStep(step) {
  if (typeof step.prepare === 'function') {
    step.prepare()
    return
  }
  applyAttributes(step.element, step.from)
}

function playStep(renderer, step) {
  if (typeof step.play === 'function') {
    return step.play(renderer)
  }
  return renderer.animate(step.element, step.from, step.to, step.options)
}

function restoreOptionalAttribute(element, name, value) {
  if (value === null || value === undefined) {
    element.removeAttribute(name)
    return
  }
  element.setAttribute(name, value)
}

function readPointsAttribute(element, name) {
  const raw = element.getAttribute(name)
  if (!raw) return null

  try {
    const points = JSON.parse(raw)
    if (!Array.isArray(points)) return null

    return points.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1])
    )
      ? points
      : null
  } catch {
    return null
  }
}

function readNumberAttribute(element, name, fallback) {
  const raw = element.getAttribute(name)
  if (raw === null) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function finitePositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function finiteNonNegativeNumber(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}
