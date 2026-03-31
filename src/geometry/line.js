import { createChannel, createChannels } from './channel.js'
import { channelStyles } from './style.js'
import { defined, group } from '../utils'

export function line(renderer, I, scales, channels, directStyles, coordinate) {
  const series = channels.z
    ? Array.from(group(Array.from(I), (i) => channels.z[i]).values())
    : [Array.from(I)]

  return series.flatMap((indices) => {
    const points = indices
      .filter((i) => defined(channels.x[i]) && defined(channels.y[i]))
      .map((i) => ({
        index: i,
        point: coordinate([channels.x[i], channels.y[i]])
      }))

    if (points.length < 2) return []

    const d = points.map(({ point: [x, y] }, index) => [
      index === 0 ? 'M' : 'L',
      x,
      y
    ])
    const [{ index }] = points

    return [
      renderer.path({
        fill: 'none',
        ...directStyles,
        ...channelStyles(index, channels),
        d
      })
    ]
  })
}

line.channels = () =>
  createChannels({
    z: createChannel({ name: 'z' })
  })
