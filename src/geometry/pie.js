import { createChannel } from './channel.js'
import { createGeometry } from './geometry.js'
import { interval } from './interval.js'

export const pie = createGeometry(
  {
    angle: createChannel({ name: 'angle', optional: false }),
    innerRadius: createChannel({ name: 'innerRadius' }),
    outerRadius: createChannel({ name: 'outerRadius' }),
    stroke: createChannel({ name: 'stroke' }),
    fill: createChannel({ name: 'fill' })
  },
  (renderer, I, scales, channels, directStyles, coordinate) => {
    if (!coordinate.isPolar?.()) {
      throw new Error('Geometry "pie" requires polar coordinates.')
    }

    const { angle: A, innerRadius: R0 = [], outerRadius: R1 = [] } = channels
    const values = Array.from(I, (index) => toAngleValue(A[index]))
    const total = values.reduce((sum, value) => sum + value, 0)

    if (total <= 0) {
      throw new Error(
        'Geometry "pie" requires at least one positive angle value.'
      )
    }

    const x = new Array(A.length)
    const x1 = new Array(A.length)
    const y = new Array(A.length)
    const y1 = new Array(A.length)

    let start = 0
    Array.from(I, (index, position) => {
      const end = start + values[position] / total
      x[index] = start
      x1[index] = end
      y[index] = R1[index] ?? 1
      y1[index] = R0[index] ?? 0
      start = end
      return null
    })

    return interval(
      renderer,
      I,
      scales,
      {
        ...channels,
        x,
        x1,
        y,
        y1
      },
      directStyles,
      coordinate
    )
  }
)

function toAngleValue(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(
      'Geometry "pie" requires finite, non-negative angle values.'
    )
  }
  return numericValue
}
