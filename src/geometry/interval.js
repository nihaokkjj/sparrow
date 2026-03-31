import { createChannel, createChannels } from './channel.js'
import { createGeometry } from './geometry.js'
import { rect } from './shape.js'
import { channelStyles } from './style.js'

export const interval = createGeometry(
  createChannels({
    x1: createChannel({ name: 'x1' }),
    y1: createChannel({ name: 'y1' })
  }),
  (renderer, I, scales, channels, directStyles, coordinate) => {
    if (coordinate.isPolar?.()) {
      throw new Error('Geometry "interval" does not support polar coordinates yet.')
    }

    const { x: X, x1: X1 = [], y: Y, y1: Y1 = [] } = channels
    const defaultY1 = 0

    return Array.from(I, (i) => {
      const x = X[i]
      const x1 = X1[i] ?? inferX1(scales, x)
      const y = Y[i]
      const y1 = Y1[i] ?? defaultY1

      return rect(renderer, coordinate, {
        ...directStyles,
        ...channelStyles(i, channels),
        x,
        x1,
        y,
        y1
      })
    })
  }
)

function inferX1(scales, x) {
  const width = scales.x?.bandWidth?.()
  if (width === undefined) {
    throw new Error('Interval geometry requires x1 values or an x band scale.')
  }
  return x + width
}
