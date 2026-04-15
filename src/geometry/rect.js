import { createChannel, createChannels } from './channel.js'
import { createGeometry } from './geometry.js'
import { rect as drawRect } from './shape.js'
import { channelStyles } from './style.js'

export const rect = createGeometry(
  createChannels({
    x1: createChannel({ name: 'x1' }),
    y1: createChannel({ name: 'y1' })
  }),
  (renderer, I, scales, channels, directStyles, coordinate) => {
    if (coordinate.isPolar?.()) {
      throw new Error('Geometry "rect" does not support polar coordinates yet.')
    }

    const { x: X, x1: X1 = [], y: Y, y1: Y1 = [] } = channels

    return Array.from(I, (i) =>
      drawRect(renderer, coordinate, {
        ...directStyles,
        ...channelStyles(i, channels),
        x: X[i],
        x1: X1[i] ?? 0,
        y: Y[i],
        y1: Y1[i] ?? 0
      })
    )
  }
)
