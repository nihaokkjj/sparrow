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
    const { x: X, x1: X1 = [], y: Y, y1: Y1 = [] } = channels
    const defaultY1 = 0

    return Array.from(I, (i) => {
      const x = X[i]
      const x1 = X1[i] ?? inferX1(scales, x)
      const y = Y[i]
      const y1 = Y1[i] ?? defaultY1

      if (coordinate.isPolar?.()) {
        return renderer.path({
          ...directStyles,
          ...channelStyles(i, channels),
          d: sectorPath(coordinate, { x, x1, y, y1 })
        })
      }

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

function sectorPath(coordinate, { x, x1, y, y1 }) {
  const steps = Math.max(4, Math.ceil(Math.abs(x1 - x) * 64))
  const outer = sampleArc(coordinate, x, x1, y, steps, true)
  const inner = sampleArc(coordinate, x1, x, y1, steps, false)
  return [...outer, ...inner, ['Z']]
}

function sampleArc(coordinate, start, end, radius, steps, moveToFirst) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const angle = start * (1 - t) + end * t
    const [x, y] = coordinate([angle, radius])
    return [moveToFirst && index === 0 ? 'M' : 'L', x, y]
  })
}

function inferX1(scales, x) {
  const width = scales.x?.bandWidth?.()
  if (width === undefined) {
    throw new Error('Interval geometry requires x1 values or an x band scale.')
  }
  return x + width
}
