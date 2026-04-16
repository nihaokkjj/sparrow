const DEFAULT_ENTER_ANIMATIONS = {
  point: { preset: 'pop-in', duration: 520, ease: 'easeOut' },
  line: { preset: 'draw-in', duration: 520, ease: 'easeOut' },
  interval: {
    preset: 'stagger-rise-in',
    duration: 560,
    ease: 'easeOut',
    stagger: 72
  },
  pie: { preset: 'sweep-in', duration: 520, ease: 'easeOut' },
  area: { preset: 'grow-y', duration: 520, ease: 'easeOut' },
  rect: { preset: 'grow-y', duration: 520, ease: 'easeOut' },
  cell: {
    preset: 'stagger-rise-in',
    duration: 420,
    ease: 'easeOut',
    stagger: 28
  },
  text: { preset: 'rise-in', duration: 360, ease: 'easeOut' }
}

export function applyPlaygroundAnimationPreference(
  spec,
  { enabled = false } = {}
) {
  const next = cloneSpec(spec)
  if (!next || typeof next !== 'object' || Array.isArray(next)) {
    return next
  }

  if (!enabled) {
    stripAnimations(next)
    return next
  }

  ensurePlotAnimations(next)
  return next
}

function cloneSpec(spec) {
  if (spec === null || spec === undefined) return spec
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(spec)
  }
  return JSON.parse(JSON.stringify(spec))
}

function stripAnimations(node) {
  visitSpecNodes(node, (target) => {
    delete target.animation
  })
}

function ensurePlotAnimations(node) {
  visitPlots(node, (plot) => {
    if (plot.animation) return
    const animation = defaultAnimationFor(plot.type)
    if (animation) plot.animation = animation
  })
}

function defaultAnimationFor(type) {
  const animation = DEFAULT_ENTER_ANIMATIONS[type]
  return animation ? { enter: { ...animation } } : null
}

function visitSpecNodes(node, visitor) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return

  visitor(node)

  if (Array.isArray(node.plots)) {
    node.plots.forEach((plot) => visitSpecNodes(plot, visitor))
  }

  if (Array.isArray(node.plot)) {
    node.plot.forEach((plot) => visitSpecNodes(plot, visitor))
  } else if (node.plot && typeof node.plot === 'object') {
    visitSpecNodes(node.plot, visitor)
  }

  if (node.view && typeof node.view === 'object') {
    visitSpecNodes(node.view, visitor)
  }

  if (
    Array.isArray(node.children) &&
    ['row', 'col', 'layer', 'facet'].includes(node.type)
  ) {
    node.children.forEach((child) => visitSpecNodes(child, visitor))
  }
}

function visitPlots(node, visitor) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return

  if (Array.isArray(node.plots)) {
    node.plots.forEach((plot) => visitPlots(plot, visitor))
    return
  }

  if (Array.isArray(node.plot)) {
    node.plot.forEach((plot) => visitPlots(plot, visitor))
    return
  }

  if (node.plot && typeof node.plot === 'object') {
    visitPlots(node.plot, visitor)
    return
  }

  if (node.view && typeof node.view === 'object') {
    visitPlots(node.view, visitor)
    return
  }

  if (
    Array.isArray(node.children) &&
    ['row', 'col', 'layer', 'facet'].includes(node.type)
  ) {
    node.children.forEach((child) => visitPlots(child, visitor))
    return
  }

  if (typeof node.type === 'string') {
    visitor(node)
  }
}
