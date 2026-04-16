import { createRenderer } from '../renderer/renderer.js'
import { computeFacetViews } from '../views/facet.js'
import { computeFlexViews } from '../views/flex.js'
import { computeLayerViews } from '../views/layer.js'
import { renderPlotSpec } from './renderPlotSpec.js'

const DEFAULT_SIZE = {
  width: 960,
  height: 540
}

const VIEW_TYPES = new Set(['row', 'col', 'layer', 'facet'])
const MARK_TYPES = new Set([
  'point',
  'line',
  'interval',
  'pie',
  'area',
  'rect',
  'cell',
  'text'
])

const VIEW_COMPUTES = {
  row: computeFlexViews,
  col: computeFlexViews,
  layer: computeLayerViews,
  facet: computeFacetViews
}

export function renderAISpec(input, options = {}) {
  if (!hasViewRoot(input) && isPlotLikeSpec(input)) {
    return renderPlotSpec(input, options)
  }

  const spec = normalizeAISpec(input, options)
  const renderer = options.renderer || createRenderer(spec.width, spec.height)
  const renderedViews = []

  renderViewNode(spec.view, spec.frame, {
    renderer,
    renderedViews,
    inheritedData: Array.isArray(spec.data) ? spec.data : undefined,
    dataTransform: null,
    path: 'view'
  })

  const node = renderer.node()
  mountNode(node, spec.container, spec.clear)

  const playAnimations = () =>
    renderedViews.flatMap(({ result }) => result.playAnimations?.() || [])
  const stopAnimations = () =>
    renderedViews.forEach(({ result }) => result.stopAnimations?.())

  if (options.autoplay !== false && node.isConnected) {
    playAnimations()
  }

  return {
    renderer,
    node,
    marks: renderedViews.flatMap(({ result }) => result.marks || []),
    plots: renderedViews.flatMap(({ result }) => result.plots || []),
    plot: renderedViews[0]?.result?.plot ?? null,
    playAnimations,
    stopAnimations,
    views: renderedViews,
    view: spec.view
  }
}

function renderViewNode(node, frame, context) {
  if (isViewNode(node)) {
    renderLayoutNode(node, frame, context)
    return
  }

  renderLeafNode(node, frame, context)
}

function renderLayoutNode(node, frame, context) {
  const inheritedData = Array.isArray(node.data)
    ? node.data
    : context.inheritedData

  if (node.type === 'facet') {
    const data = applyDataTransform(inheritedData, context.dataTransform)
    const childViews = VIEW_COMPUTES.facet(frame, {
      ...node,
      data
    })

    node.children.forEach((child, childIndex) => {
      childViews.forEach((childView, facetIndex) => {
        renderViewNode(child, childView, {
          ...context,
          inheritedData,
          dataTransform: composeDataTransform(
            context.dataTransform,
            childView.transform
          ),
          path: `${context.path}.children[${childIndex}].facet[${facetIndex}]`
        })
      })
    })
    return
  }

  const childViews = VIEW_COMPUTES[node.type](frame, node)
  node.children.forEach((child, index) => {
    renderViewNode(child, childViews[index], {
      ...context,
      inheritedData,
      path: `${context.path}.children[${index}]`
    })
  })
}

function renderLeafNode(node, frame, context) {
  const spec = materializeLeafSpec(node, {
    inheritedData: context.inheritedData,
    dataTransform: context.dataTransform
  })

  const result = renderPlotSpec(spec, {
    renderer: context.renderer,
    clear: false,
    frame,
    autoplay: false
  })

  context.renderedViews.push({
    path: context.path,
    view: {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height
    },
    spec,
    result
  })
}

function normalizeAISpec(input, options) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('renderAISpec expects an object spec.')
  }

  const width = options.width ?? input.width ?? DEFAULT_SIZE.width
  const height = options.height ?? input.height ?? DEFAULT_SIZE.height
  const padding = normalizePadding(input.padding)
  const frame = {
    x: padding.left,
    y: padding.top,
    width: width - padding.left - padding.right,
    height: height - padding.top - padding.bottom
  }

  if (frame.width <= 0 || frame.height <= 0) {
    throw new Error('renderAISpec requires a positive root view area.')
  }

  return {
    width,
    height,
    frame,
    data: input.data,
    view: normalizeViewRoot(input.view ?? input),
    container: options.container ?? input.container,
    clear: options.clear ?? true
  }
}

function hasViewRoot(input) {
  return Boolean(
    input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    isViewNode(input.view ?? input)
  )
}

function normalizeViewRoot(node) {
  if (!isViewNode(node)) {
    throw new Error(
      'renderAISpec requires view.type to be row, col, layer, or facet.'
    )
  }

  return normalizeViewNode(node)
}

function normalizeViewNode(node) {
  const children = Array.isArray(node.children) ? node.children : []
  if (children.length === 0) {
    throw new Error(`View node "${node.type}" requires at least one child.`)
  }

  return {
    ...node,
    children: children.map(normalizeViewChild)
  }
}

function normalizeViewChild(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error('View children must be objects.')
  }

  if (isViewNode(node)) {
    return normalizeViewNode(node)
  }

  if (isPlotLikeSpec(node)) {
    return { ...node }
  }

  throw new Error(
    'View children must be nested views or plot specs with plot, plots, point, line, interval, pie, area, rect, cell, or text.'
  )
}

function materializeLeafSpec(spec, { inheritedData, dataTransform }) {
  if (!dataTransform && inheritedData === undefined) {
    return spec
  }

  const next = { ...spec }
  const scopedInheritedData = applyDataTransform(inheritedData, dataTransform)

  if (Array.isArray(next.plots)) {
    next.plots = next.plots.map((plot) =>
      materializePlot(plot, inheritedData, dataTransform)
    )
    if (next.data === undefined && scopedInheritedData !== undefined) {
      next.data = scopedInheritedData
    }
    return next
  }

  if (Array.isArray(next.plot)) {
    next.plot = next.plot.map((plot) =>
      materializePlot(plot, inheritedData, dataTransform)
    )
    if (next.data === undefined && scopedInheritedData !== undefined) {
      next.data = scopedInheritedData
    }
    return next
  }

  if (next.plot && typeof next.plot === 'object') {
    next.plot = materializePlot(next.plot, inheritedData, dataTransform)
    if (next.data === undefined && scopedInheritedData !== undefined) {
      next.data = scopedInheritedData
    }
    return next
  }

  if (isMarkType(next.type)) {
    return materializePlot(next, inheritedData, dataTransform)
  }

  return next
}

function materializePlot(plot, inheritedData, dataTransform) {
  const source = Array.isArray(plot.data) ? plot.data : inheritedData
  if (source === undefined) return { ...plot }

  return {
    ...plot,
    data: applyDataTransform(source, dataTransform)
  }
}

function composeDataTransform(parent, child) {
  if (!parent) return child || null
  if (!child) return parent
  return (data) => child(parent(data))
}

function applyDataTransform(data, transform) {
  if (!Array.isArray(data)) return data
  return transform ? transform(data) : data
}

function isViewNode(node) {
  return Boolean(node && typeof node === 'object' && VIEW_TYPES.has(node.type))
}

function isPlotLikeSpec(node) {
  return Boolean(
    node &&
    typeof node === 'object' &&
    !Array.isArray(node) &&
    (Array.isArray(node.plots) ||
      Array.isArray(node.plot) ||
      node.plot ||
      isMarkType(node.type))
  )
}

function isMarkType(type) {
  return MARK_TYPES.has(type)
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
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0
  }
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
