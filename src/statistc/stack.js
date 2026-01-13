import { group } from '../utils'

export function createStackY() {
  return ({ index, values }) => {
    const { x: X, y: Y } = values

    //根据x通信值进行分组
    const series = X ? Array.from(group(index, (i) => X[i]).values()) : [index]

    const newY = new Array(index.length)
    const newY1 = new Array(index.length)

    //对每个分组的y进行累加
    for (const I of series) {
      //相同x的y进行累加
      for (let py = 0, i = 0; i < I.length; py = newY[I[i]], i += 1) {
        const index = I[i]
        newY1[index] = py
        newY[index] = py + Y[index]
      }
    }

    return {
      index,
      // 返回修改后的 y 通道的值，并且新增一个 y1 通道
      values: { ...values, y: newY, y1: newY1 }
    }
  }
}
