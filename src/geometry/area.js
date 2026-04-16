import { createChannel, createChannels } from './channel.js'
import { channelStyles } from './style.js'
import { areaPath } from './areaPath.js'
import { defined, group } from '../utils'

export function area(renderer, I, scales, channels, directStyles, coordinate) {
  const { x: X, x1: X1 = [], y: Y, y1: Y1 = [] } = channels
  const series = channels.z
    ? Array.from(group(Array.from(I), (i) => channels.z[i]).values())
    : [Array.from(I)]

  return series.flatMap((indices) => {
    const points = indices
      .filter((i) => defined(X[i]) && defined(Y[i]) && defined(Y1[i] ?? 0))
      .map((i) => ({
        index: i,
        top: coordinate([X[i], Y[i]]),
        bottom: coordinate([X1[i] ?? X[i], Y1[i] ?? 0])
      }))

    if (points.length < 2) return []

    const [{ index }] = points
    const topPoints = points.map(({ top }) => top)
    const bottomPoints = points.map(({ bottom }) => bottom)

    const mark = renderer.path({
      stroke: 'none',
      ...directStyles,
      ...channelStyles(index, channels),
      d: areaPath(topPoints, bottomPoints)
    })
    annotateArea(mark, topPoints, bottomPoints)

    return [mark]
  })
}

area.channels = () =>
  createChannels({
    x1: createChannel({ name: 'x1' }),
    y1: createChannel({ name: 'y1' }),
    z: createChannel({ name: 'z' })
  })

function annotateArea(element, topPoints, bottomPoints) {
  element.setAttribute('data-sparrow-area-top', JSON.stringify(topPoints))
  element.setAttribute('data-sparrow-area-bottom', JSON.stringify(bottomPoints))
}
