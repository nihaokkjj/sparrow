import { expect, test } from 'vitest'
import { createNormalizeY } from '../../src/statistic/normalize.js'

test('createNormalizeY normalizes y values within each x group', () => {
  const normalizeY = createNormalizeY()
  const data = {
    index: [0, 1, 2, 3],
    values: {
      x: ['A', 'A', 'B', 'B'],
      y: [2, 4, 5, 10]
    }
  }

  const result = normalizeY(data)
  expect(result.values.y).toEqual([0.5, 1, 0.5, 1])
  expect(result.values.x).toEqual(['A', 'A', 'B', 'B'])
})

test('createNormalizeY preserves existing y1 channel when provided', () => {
  const normalizeY = createNormalizeY()
  const data = {
    index: [0, 1],
    values: {
      y: [4, 2],
      y1: [1, 2]
    }
  }

  const result = normalizeY(data)
  expect(result.values.y).toEqual([1, 0.5])
  expect(result.values.y1).toEqual([0.25, 0.5])
})
