import { group } from '../utils'

export function createNormalizeY() {
  return ({ index, values }) => {
    const { x: X } = values

    //按照x通道进行分组
    const series = X ? Array.from(group(index, (i) => X[i]).values()) : [index]

    //生成定义了y方向的通道值
    const newValues = Object.fromEntries(
      ['y1', 'y']
        .filter((key) => values[key])
        .map((key) => [key, new Array(index.length)])
    )

    //处理每一个分组
    for (const I of series) {
      const Y = I.flatMap((i) =>
        Object.keys(newValues).map((key) => values[key][i])
      )
      const n = Math.max(...Y) //找到该组中最大的y

      //归一化每一条数据的每一个y方向通道的值
      for (const i of I) {
        for (const key of Object.keys(newValues)) {
          newValues[key][i] = values[key][i] / n
        }
      }
    }

    return {
      index,
      values: {
        ...values,
        ...newValues
      }
    }
  }
}
