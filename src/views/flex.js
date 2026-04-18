import { resolveViewGap } from './gap.js'

export function computeFlexViews(box, node) {
  const { type, children, flex = children.map(() => 1), padding } = node
  const [mainStart, mainSize, crossSize, crossStart] =
    type === 'col'
      ? ['y', 'height', 'width', 'x']
      : ['x', 'width', 'height', 'y']
  const gap = resolveViewGap({
    padding,
    mainSize: box[mainSize],
    crossSize: box[crossSize],
    slots: children.length
  })

  const sum = flex.reduce((total, value) => total + value)
  const totalSize = box[mainSize] - gap * (children.length - 1)
  const sizes = flex.map((value) => totalSize * (value / sum))

  const childrenViews = []
  for (
    let next = box[mainStart], i = 0;
    i < sizes.length;
    next += sizes[i] + gap, i += 1
  ) {
    childrenViews.push({
      [mainStart]: next,
      [mainSize]: sizes[i],
      [crossStart]: box[crossStart],
      [crossSize]: box[crossSize]
    })
  }
  return childrenViews
}
