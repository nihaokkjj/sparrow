import { expect, test } from 'vitest'
import { createCoordinate } from '../../src/coordinate/coordinate.js'

test('createCoordinate(options) returns a identity function without transforms', () => {
  const c = createCoordinate({
    transforms: []
  })
  expect(c(1)).toBe(1)
  expect(c(2)).toBe(2)
})
