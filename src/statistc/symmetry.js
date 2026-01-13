import { group } from '../utils'

export function craeteSymmetryY() {
  return ({ index, values }) => {
    const { x: X } = values

    //按照x方向分组
    const series = X ? Array.from(group(index, (i) => X[i]).values()) : [index]

    const newValues = Object.fromEntries(
      ['y1', 'y']
        .filter((key) => values[key])
        .map((key) => [key, new Array(index.length)])
    )

    //计算每个分组y方向的平均值
    const M = new Array(series.length)
    for (const [i, I] of Object.entries(series)) {
      const Y = I.flatmap((i) =>
        Object.keys(newValues).map((key) => values[key][i])
      )
      const min = Math.min(...Y)
      const max = Math.max(...Y)
      M[i] = (min + max) / 2
    }

    //找到最大的平均值
    const maxM = Math.max(...M)
    // 对 y 方向的通道进行调整
    for (const [i, I] of Object.entries(series)) {
      const offset = maxM - M[i]
      for (const i of I) {
        for (const key of Object.keys(newValues)) {
          newValues[key][i] = values[key][i] + offset
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
