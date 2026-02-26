import { identity } from '../utils'

// components 不同坐标系对应的绘制组件
// labelOf 获取标签绘制需要的刻度
export function createAxis(components, labelOf) {
  // renderer 渲染器
  // scale 比例尺
  // cooridante 坐标系
  // domain 比例尺的定义域（对离散比例尺有用）
  // label 绘制的标签内容
  // tickCount 刻度数量（对连续比例尺有用）
  // formatter 格式化刻度的函数
  // tickLength 刻度的长度
  // fontSize 刻度文本和标签的字号
  // grid 是否绘制格子
  return (
    renderer,
    scale,
    coordinate,
    {
      domain,
      label,
      tickCount = 5,
      formatter = identity,
      tickLength = 5,
      fontSize = 12,
      grid = false,
      tick = true
    }
  ) => {
    // 获得 ticks 的值
    const offset = scale.bandWidth ? scale.bandWidth() / 2 : 0
    const values = scale.ticks ? scale.ticks(tickCount) : domain

    // 处理一些绘制需要的属性
    const center = coordinate.center()
    // 转换成 00、01、11、10
    const type = `${+coordinate.isPolar()}${+coordinate.isTranspose()}`
    const options = { tickLength, fontSize, center }

    // 根据当前坐标系种类选择对应的绘制格子、刻度和标签的方法
    const {
      grid: Grid,
      ticks: Ticks,
      label: Label,
      start,
      end
    } = components[type]

    // 计算得到刻度真正的坐标和展示的文本
    const ticks = values.map((d) => {
      const [x, y] = coordinate(start(d, scale, offset))
      const text = formatter(d)
      return { x, y, text }
    })

    // 按需绘制格子、刻度和标签
    if (grid && Grid) Grid(renderer, ticks, end(coordinate))
    if (tick && Ticks) Ticks(renderer, ticks, options)
    if (label && Label) Label(renderer, label, labelOf(ticks), options)
  }
}
