export const easing = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
}

export function tween({
  from = 0,
  to = 1,
  duration = 300,
  ease = 'linear',
  onUpdate,
  onComplete
} = {}) {
  const start = performance.now()
  const easeFn =
    typeof ease === 'function' ? ease : easing[ease] || easing.linear
  let stopped = false
  let rafId = 0

  const tick = (now) => {
    if (stopped) return
    const t = Math.min((now - start) / duration, 1)
    const k = easeFn(t)
    const value = from + (to - from) * k
    if (onUpdate) onUpdate(value, k)

    if (t < 1) {
      rafId = requestAnimationFrame(tick)
    } else if (onComplete) {
      onComplete()
    }
  }

  rafId = requestAnimationFrame(tick)

  return {
    stop() {
      stopped = true
      cancelAnimationFrame(rafId)
    }
  }
}

export function animateElement(
  element,
  from,
  to,
  { duration = 300, ease = 'linear', onUpdate, onComplete } = {}
) {
  const start = performance.now()
  const keys = Object.keys(to)
  const easeFn =
    typeof ease === 'function' ? ease : easing[ease] || easing.linear
  let stopped = false
  let rafId = 0

  const tick = (now) => {
    if (stopped) return
    const t = Math.min((now - start) / duration, 1)
    const k = easeFn(t)

    keys.forEach((key) => {
      const a = from[key]
      const b = to[key]
      if (typeof a === 'number' && typeof b === 'number') {
        const v = a + (b - a) * k
        element.setAttribute(key, v)
      } else if (t === 1) {
        element.setAttribute(key, b)
      }
    })

    if (onUpdate) onUpdate(k)

    if (t < 1) {
      rafId = requestAnimationFrame(tick)
    } else if (onComplete) {
      onComplete()
    }
  }

  rafId = requestAnimationFrame(tick)

  return {
    stop() {
      stopped = true
      cancelAnimationFrame(rafId)
    }
  }
}

export function animateAttributes(element, from, to, options) {
  return animateElement(element, from, to, options)
}

export function animateSequence(steps = []) {
  let stopped = false
  let current = null
  let timeoutId = null

  const runStep = (index) => {
    if (stopped || index >= steps.length) return
    const { element, from, to, options = {} } = steps[index]
    const { delay = 0, onComplete } = options

    const start = () => {
      current = animateElement(element, from, to, {
        ...options,
        onComplete: () => {
          if (onComplete) onComplete()
          runStep(index + 1)
        }
      })
    }

    if (delay > 0) timeoutId = setTimeout(start, delay)
    else start()
  }

  runStep(0)

  return {
    stop() {
      stopped = true
      if (timeoutId) clearTimeout(timeoutId)
      if (current && current.stop) current.stop()
    }
  }
}

export function animateStagger(items, factory, { delay = 0 } = {}) {
  const steps = items.map((item, index) => {
    const step = factory(item, index)
    const options = step.options || {}
    return {
      ...step,
      options: { ...options, delay: (options.delay || 0) + delay * index }
    }
  })
  return animateSequence(steps)
}
