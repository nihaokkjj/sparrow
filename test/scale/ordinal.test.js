import { createOrdinal } from '../../src/scale/ordinal'

import { expect, test } from 'vitest'

test('createOrdinal(options) returns a one-to-one scale.', () => {
  const s = createOrdinal({
    domain: ['a', 'b', 'c'],
    range: ['red', 'orange', 'yellow']
  })
  expect(s('a')).toBe('red')
  expect(s('b')).toBe('orange')
  expect(s('c')).toBe('yellow')
})
test('Ordinal scale will mode map.', () => {
  const s = createOrdinal({
    domain: ['a', 'b', 'c', 'd', 'e'],
    range: ['red', 'yellow', 'blue']
  })
  expect(s('d')).toBe('red')
  expect(s('e')).toBe('yellow')
})
