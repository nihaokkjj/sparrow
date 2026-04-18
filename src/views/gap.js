export const DEFAULT_VIEW_GAP = 40
export const MIN_ADAPTIVE_VIEW_GAP = 8

export function resolveViewGap({
  padding,
  mainSize,
  crossSize,
  slots
}) {
  if (Number.isFinite(padding) && padding >= 0) {
    return padding
  }

  return computeAdaptiveViewGap({
    mainSize,
    crossSize,
    slots
  })
}

export function computeAdaptiveViewGap({ mainSize, crossSize, slots }) {
  if (!Number.isFinite(slots) || slots <= 1) return 0
  if (!Number.isFinite(mainSize) || mainSize <= 0) return DEFAULT_VIEW_GAP
  if (!Number.isFinite(crossSize) || crossSize <= 0) return DEFAULT_VIEW_GAP

  const minSide = Math.min(mainSize, crossSize)
  const axisDriven = mainSize / Math.max(10, slots * 10)
  const crossDriven = crossSize / 18
  const densityDriven = minSide / (slots + 4)
  const adaptiveGap = Math.min(
    axisDriven,
    crossDriven,
    densityDriven,
    DEFAULT_VIEW_GAP
  )

  return clamp(
    Math.round(adaptiveGap),
    MIN_ADAPTIVE_VIEW_GAP,
    DEFAULT_VIEW_GAP
  )
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
