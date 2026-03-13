import { expect, test } from 'vitest'
import { create } from '../../src/plot/create.js'
import { point } from '../../src/geometry/point.js'

test('create returns point geometry for point marks', () => {
  expect(create({ type: 'point' })).toBe(point)
})

test('create throws a clear error for unsupported geometry marks', () => {
  expect(() => create({ type: 'line' })).toThrowError(
    'Geometry "line" is not implemented yet.'
  )
})
