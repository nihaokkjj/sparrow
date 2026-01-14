export function computeLayerViews(box, node) {
  const { children = [] } = node
  //将自己区域大小作为孩子节点的区域大小
  return new Array(children.length).fill(0).map(() => ({ ...box }))
}
