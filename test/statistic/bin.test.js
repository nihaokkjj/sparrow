import { expect, test } from 'vitest'
import { createBinX } from '../../src/statistic/bin.js'

test('createBinX counts items per bin and carries forward companion channels', () => {
  const data = {
    index: [0, 1, 2, 3],
    values: {
      x: [1, 2, 9, 10],
      y: ['a', 'b', 'c', 'd']
    }
  }

  const binX = createBinX({ count: 2, channel: 'fill' })

  expect(binX(data)).toEqual({
    index: [0, 1],
    values: {
      x: [0, 5],
      x1: [5, 10],
      fill: [2, 2],
      y: ['a', 'c']
    }
  })
})

test('createBinX aggregates the source channel values when present', () => {
  const data = {
    index: [0, 1, 2, 3],
    values: {
      x: [1, 2, 9, 10],
      y: [1, 2, 3, 4]
    }
  }

  const binX = createBinX({
    count: 2,
    channel: 'y',
    aggregate: (values) => values.reduce((sum, value) => sum + value, 0)
  })

  expect(binX(data)).toEqual({
    index: [0, 1],
    values: {
      x: [0, 5],
      x1: [5, 10],
      y: [3, 7]
    }
  })
})
