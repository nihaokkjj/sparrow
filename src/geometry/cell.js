import { createChannel, createChannels } from './channel.js'
import { createGeometry } from './geometry.js'
import { rect as drawRect } from './shape.js'
import { channelStyles } from './style.js'

export const cell = createGeometry(
  createChannels({
    x: createChannel({ name: 'x', optional: false, scale: 'band' }),
    y: createChannel({ name: 'y', optional: false, scale: 'band' })
  }),
  (renderer, I, scales, channels, directStyles, coordinate) => {
    if (coordinate.isPolar?.()) {
      throw new Error('Geometry "cell" does not support polar coordinates yet.')
    }

    const { x: X, y: Y } = channels
    const xWidth = scales.x.bandWidth()
    const yWidth = scales.y.bandWidth()

    return Array.from(I, (i) =>
      drawRect(renderer, coordinate, {
        ...directStyles,
        ...channelStyles(i, channels),
        x: X[i],
        x1: X[i] + xWidth,
        y: Y[i],
        y1: Y[i] + yWidth
      })
    )
  }
)
