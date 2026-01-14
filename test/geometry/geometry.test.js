import { expect, test, vi } from 'vitest'
import { createGeometry } from '../../src/geometry/geometry.js'

test('createGeometry throws when required channel missing', () => {
  const g = createGeometry(
    {
      x: { name: 'x', optional: false }
    },
    () => []
  )

  expect(() =>
    g({}, [0], {}, { y: [10] }, {}, (d) => d)
  ).toThrowError('Missing Channel: x')
})

test('createGeometry validates band scale requirement', () => {
  const g = createGeometry(
    {
      x: { name: 'x', optional: false, scale: 'band' }
    },
    () => []
  )

  expect(() =>
    g({}, [0], {}, { x: [10] }, {}, (d) => d)
  ).toThrowError('x channel needs band scale.')
})

test('createGeometry forwards arguments to render when validation passes', () => {
  const spy = vi.fn(() => 'rendered')
  const g = createGeometry(
    {
      x: { name: 'x', optional: false }
    },
    spy
  )
  const scales = { x: { bandWidth: () => 10 } }
  const values = { x: [0], y: [1] }
  const result = g({}, [0], scales, values, { stroke: '#000' }, (d) => d)
  expect(spy).toHaveBeenCalledOnce()
  expect(result).toBe('rendered')
})
