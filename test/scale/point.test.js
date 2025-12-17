import { createPoint } from '../../src/scale/point.js'

import { expect, test } from 'vitest'

test('createPoint(options) maps discrete domain to continuous range with padding fixed to 0.', () => {
  const s = createPoint({
    domain: ['a', 'b', 'c'],
    range: [0, 32]
  })
  expect(s('a')).toBe(8)
  expect(s('b')).toBe(16)
  expect(s('c')).toBe(24)
  expect(s.bandWidth()).toBe(0)
  expect(s.step()).toBe(8)
})
