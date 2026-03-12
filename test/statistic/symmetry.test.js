import { expect, test } from 'vitest'
import { createSymmetryY } from '../../src/statistic/symmetry.js'

test('createSymmetryY aligns group midpoints to the maximum midpoint', () => {
  const symmetryY = createSymmetryY()
  const data = {
    index: [0, 1, 2, 3],
    values: {
      x: ['A', 'A', 'B', 'B'],
      y: [2, 6, 1, 3]
    }
  }

  const result = symmetryY(data)
  // Group A midpoint: (2+6)/2 = 4
  // Group B midpoint: (1+3)/2 = 2
  // maxM = 4, so group B gets +2 offset
  expect(result.values.y).toEqual([2, 6, 3, 5])
})
