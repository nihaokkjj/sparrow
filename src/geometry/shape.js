// 绘制不同坐标系下面的圆
// 绘制圆的函数和渲染器里面绘制圆的区别在于
// 这里需要考虑坐标系
export function circle(renderer, coordinate, { cx, cy, r, ...styles }) {
  // 对圆心进行坐标系变换
  const [px, py] = coordinate([cx, cy])
  return renderer.circle({ cx: px, cy: py, r, ...styles })
}

export function rect(renderer, coordinate, { x, y, x1, y1, ...styles }) {
  const [px0, py0] = coordinate([x, y])
  const [px1, py1] = coordinate([x1, y1])
  return renderer.rect({
    x: px0,
    y: py0,
    width: px1 - px0,
    height: py1 - py0,
    ...styles
  })
}
