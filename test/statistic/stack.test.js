import { expect, test } from 'vitest'
import { createStackY } from '../../src/statistic/stack.js'

test('createStackY stacks y values within each x group', () => {
  const stackY = createStackY()
  const data = {
    index: [0, 1, 2, 3],
    values: {
      x: ['A', 'A', 'B', 'B'],
      y: [2, 3, 4, 1]
    }
  }

  const result = stackY(data)
  expect(result.values.y1).toEqual([0, 2, 0, 4])
  expect(result.values.y).toEqual([2, 5, 4, 5])
})

test('createStackY stacks without x channel as single series', () => {
  const stackY = createStackY()
  const data = {
    index: [0, 1, 2],
    values: {
      y: [1, 2, 3]
    }
  }

  const result = stackY(data)
  expect(result.values.y1).toEqual([0, 1, 3])
  expect(result.values.y).toEqual([1, 3, 6])
})
