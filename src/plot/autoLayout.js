import { computeFacetViews } from '../views/facet.js'
import { computeFlexViews } from '../views/flex.js'
import { DEFAULT_VIEW_GAP, resolveViewGap } from '../views/gap.js'
import { computeLayerViews } from '../views/layer.js'

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

const DEFAULT_CHILD_PADDING = {
  top: 24,
  right: 96,
  bottom: 48,
  left: 56
}
const DEFAULT_MIN_PLOT_SIZE = {
  width: 24,
  height: 24
}
const AUTO_LAYOUT_MIN_CHILDREN = 4

export const AUTO_LAYOUT_SPACER_TYPE = '__sparrow_auto_layout_spacer__'

export function autoLayoutView(view, frame) {
  if (!isViewNode(view)) return view

  const next = maybeNormalizeUniformGridNode(maybeAutoLayoutNode(view, frame))
  if (next.type === 'facet') {
    const facetViews = VIEW_COMPUTES.facet(frame, next)
    const sampleFrame = facetViews[0] || frame

    return {
      ...next,
      children: next.children.map((child) =>
        isViewNode(child) ? autoLayoutView(child, sampleFrame) : child
      )
    }
  }

  if (!VIEW_COMPUTES[next.type]) return next
  const childFrames = VIEW_COMPUTES[next.type](frame, next)

  return {
    ...next,
    children: next.children.map((child, index) =>
      isViewNode(child) ? autoLayoutView(child, childFrames[index]) : child
    )
  }
}

export function choosePrimeGridLayout({
  width,
  height,
  n,
  gapX,
  gapY,
  padding,
  outerPadding = { top: 0, right: 0, bottom: 0, left: 0 },
  childPadding = DEFAULT_CHILD_PADDING,
  guideReserve = { top: 0, right: 0, bottom: 0, left: 0 },
  minPlotWidth = DEFAULT_MIN_PLOT_SIZE.width,
  minPlotHeight = DEFAULT_MIN_PLOT_SIZE.height
}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || n <= 0) {
    throw new Error('Invalid layout input.')
  }

  const availableWidth =
    width - outerPadding.left - outerPadding.right
  const availableHeight =
    height - outerPadding.top - outerPadding.bottom
  let best = null

  for (let rows = 1; rows <= n; rows += 1) {
    const cols = Math.ceil(n / rows)
    const countsPerRow = distributeCountsSymmetrically(n, rows, cols)
    const resolvedGapX = resolveCandidateGap({
      gap: gapX,
      padding,
      mainSize: availableWidth,
      crossSize: availableHeight,
      slots: cols
    })
    const resolvedGapY = resolveCandidateGap({
      gap: gapY,
      padding,
      mainSize: availableHeight,
      crossSize: availableWidth,
      slots: rows
    })
    const cellWidth = (availableWidth - (cols - 1) * resolvedGapX) / cols
    const cellHeight = (availableHeight - (rows - 1) * resolvedGapY) / rows
    const plotWidth =
      cellWidth -
      childPadding.left -
      childPadding.right -
      guideReserve.left -
      guideReserve.right
    const plotHeight =
      cellHeight -
      childPadding.top -
      childPadding.bottom -
      guideReserve.top -
      guideReserve.bottom

    if (plotWidth < minPlotWidth || plotHeight < minPlotHeight) continue

    const candidate = {
      rows,
      cols,
      countsPerRow,
      gapX: resolvedGapX,
      gapY: resolvedGapY,
      cellWidth,
      cellHeight,
      plotWidth,
      plotHeight,
      emptySlots: rows * cols - n,
      symmetryPenalty: computeSymmetryPenalty(countsPerRow),
      centerPenalty: computeCenterPenalty(countsPerRow),
      aspectPenalty: Math.abs(cols / rows - width / height)
    }

    if (!best || isBetterLayout(candidate, best)) {
      best = candidate
    }
  }

  return best
}

export function distributeCountsSymmetrically(n, rows, cols) {
  const base = Math.floor(n / rows)
  const extra = n % rows
  if (extra === 0) return Array(rows).fill(base)

  let best = null
  const rowIndexes = Array.from({ length: rows }, (_, index) => index)

  for (const chosenRows of chooseRowCombinations(rowIndexes, extra)) {
    const counts = Array(rows).fill(base)
    chosenRows.forEach((index) => {
      counts[index] += 1
    })
    if (counts.some((count) => count > cols)) continue

    const candidate = {
      counts,
      symmetryPenalty: computeSymmetryPenalty(counts),
      centerPenalty: computeCenterPenalty(counts)
    }

    if (
      !best ||
      candidate.symmetryPenalty < best.symmetryPenalty ||
      (candidate.symmetryPenalty === best.symmetryPenalty &&
        candidate.centerPenalty < best.centerPenalty)
    ) {
      best = candidate
    }
  }

  return best ? best.counts : Array(rows).fill(base)
}

export function buildNestedRowColView(children, layout, options = {}) {
  const { colGap = DEFAULT_VIEW_GAP, rowGap = DEFAULT_VIEW_GAP } = options
  const { cols, countsPerRow } = layout
  let cursor = 0

  const rowChildren = countsPerRow.map((count) => {
    const slice = children.slice(cursor, cursor + count)
    cursor += count

    return {
      type: 'row',
      padding: colGap,
      __autoLayoutLocked: true,
      children: injectCenteredSpacers(slice, cols)
    }
  })

  return {
    type: 'col',
    padding: rowGap,
    __autoLayoutLocked: true,
    children: rowChildren
  }
}

export function isSpacerNode(node) {
  return Boolean(node?.type === AUTO_LAYOUT_SPACER_TYPE)
}

function maybeAutoLayoutNode(node, frame) {
  if (!isAutoLayoutEligible(node)) return node

  const childPadding = estimateChildPadding(node.children)
  const best = choosePrimeGridLayout({
    width: frame.width,
    height: frame.height,
    n: node.children.length,
    padding: node.padding,
    childPadding
  })

  if (!best) return node

  const currentLayout = {
    rows: node.type === 'col' ? node.children.length : 1,
    cols: node.type === 'row' ? node.children.length : 1
  }
  if (best.rows === currentLayout.rows && best.cols === currentLayout.cols) {
    return node
  }

  const next = buildNestedRowColView(node.children, best, {
    rowGap: best.gapY,
    colGap: best.gapX
  })

  return {
    ...node,
    type: next.type,
    padding: next.padding,
    __autoLayoutLocked: true,
    children: next.children
  }
}

function maybeNormalizeUniformGridNode(node) {
  if (!isUniformGridNormalizationEligible(node)) return node

  const targetSlots = Math.max(
    ...node.children.map((child) => child.children.length)
  )
  if (
    !Number.isFinite(targetSlots) ||
    node.children.every((child) => child.children.length === targetSlots)
  ) {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) =>
      child.children.length === targetSlots
        ? child
        : {
            ...child,
            children: injectCenteredSpacers(child.children, targetSlots)
          }
    )
  }
}

function isAutoLayoutEligible(node) {
  return Boolean(
    node &&
      (node.type === 'row' || node.type === 'col') &&
      node.__autoLayoutLocked !== true &&
      node.autoLayout !== false &&
      node?.layout?.auto !== false &&
      node.flex === undefined &&
      Array.isArray(node.children) &&
      node.children.length >= AUTO_LAYOUT_MIN_CHILDREN &&
      node.children.every((child) => isPlotLikeSpec(child))
  )
}

function isUniformGridNormalizationEligible(node) {
  const innerType =
    node?.type === 'col' ? 'row' : node?.type === 'row' ? 'col' : null
  if (!innerType) return false

  return Boolean(
    node &&
      node.__autoLayoutLocked !== true &&
      node.autoLayout !== false &&
      node?.layout?.auto !== false &&
      node.flex === undefined &&
      Array.isArray(node.children) &&
      node.children.length >= 2 &&
      node.children.every((child) => isGridAxisGroup(child, innerType))
  )
}

function isBetterLayout(a, b) {
  const aMinSide = Math.min(a.plotWidth, a.plotHeight)
  const bMinSide = Math.min(b.plotWidth, b.plotHeight)
  if (aMinSide !== bMinSide) return aMinSide > bMinSide

  const aArea = a.plotWidth * a.plotHeight
  const bArea = b.plotWidth * b.plotHeight
  if (aArea !== bArea) return aArea > bArea

  if (a.symmetryPenalty !== b.symmetryPenalty) {
    return a.symmetryPenalty < b.symmetryPenalty
  }

  if (a.centerPenalty !== b.centerPenalty) {
    return a.centerPenalty < b.centerPenalty
  }

  if (a.aspectPenalty !== b.aspectPenalty) {
    return a.aspectPenalty < b.aspectPenalty
  }

  return a.emptySlots < b.emptySlots
}

function computeSymmetryPenalty(countsPerRow) {
  let penalty = 0
  const last = countsPerRow.length - 1

  for (let index = 0; index < countsPerRow.length; index += 1) {
    penalty += Math.abs(countsPerRow[index] - countsPerRow[last - index])
  }

  return penalty
}

function computeCenterPenalty(countsPerRow) {
  const base = Math.min(...countsPerRow)
  const center = (countsPerRow.length - 1) / 2

  return countsPerRow.reduce((total, count, index) => {
    const extra = count - base
    if (extra <= 0) return total
    return total + extra * Math.abs(index - center)
  }, 0)
}

function* chooseRowCombinations(items, size, start = 0, picked = []) {
  if (picked.length === size) {
    yield picked
    return
  }

  for (let index = start; index <= items.length - (size - picked.length); index += 1) {
    yield* chooseRowCombinations(items, size, index + 1, [
      ...picked,
      items[index]
    ])
  }
}

function injectCenteredSpacers(children, cols) {
  const blankCount = cols - children.length
  if (blankCount <= 0) return children

  const leftBlankCount = Math.ceil(blankCount / 2)
  const rightBlankCount = blankCount - leftBlankCount

  return [
    ...Array.from({ length: leftBlankCount }, () => buildSpacerNode()),
    ...children,
    ...Array.from({ length: rightBlankCount }, () => buildSpacerNode())
  ]
}

function buildSpacerNode() {
  return {
    type: AUTO_LAYOUT_SPACER_TYPE,
    __autoLayoutLocked: true
  }
}

function estimateChildPadding(children) {
  return children.reduce(
    (padding, child) => {
      const next = normalizeChildPadding(child?.padding)
      return {
        top: Math.max(padding.top, next.top),
        right: Math.max(padding.right, next.right),
        bottom: Math.max(padding.bottom, next.bottom),
        left: Math.max(padding.left, next.left)
      }
    },
    { top: 0, right: 0, bottom: 0, left: 0 }
  )
}

function normalizeChildPadding(padding) {
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    }
  }

  return {
    top: padding?.top ?? DEFAULT_CHILD_PADDING.top,
    right: padding?.right ?? DEFAULT_CHILD_PADDING.right,
    bottom: padding?.bottom ?? DEFAULT_CHILD_PADDING.bottom,
    left: padding?.left ?? DEFAULT_CHILD_PADDING.left
  }
}

function resolveCandidateGap({ gap, padding, mainSize, crossSize, slots }) {
  if (Number.isFinite(gap) && gap >= 0) return gap

  return resolveViewGap({
    padding,
    mainSize,
    crossSize,
    slots
  })
}

function isViewNode(node) {
  return Boolean(node && typeof node === 'object' && VIEW_TYPES.has(node.type))
}

function isGridAxisGroup(node, type) {
  return Boolean(
    node &&
      node.type === type &&
      node.flex === undefined &&
      Array.isArray(node.children) &&
      node.children.length > 0 &&
      node.children.every((child) => isPlotLikeSpec(child) || isSpacerNode(child))
  )
}

function isPlotLikeSpec(node) {
  return Boolean(
    node &&
      typeof node === 'object' &&
      !Array.isArray(node) &&
      (Array.isArray(node.plots) ||
        Array.isArray(node.plot) ||
        node.plot ||
        MARK_TYPES.has(node.type))
  )
}
