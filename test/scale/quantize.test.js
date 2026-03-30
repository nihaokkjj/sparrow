import { createQuantize } from '../../src/scale/quantize'
import { expect, test } from 'vitest'
test('createQuantize(options) finds intervals based on value and returns corresponding value in range.', () => {
  const s = createQuantize({
    domain: [0, 1],
    range: ['a', 'b', 'c']
  })

  expect(s(0)).toBe('a')
  expect(s(0.2)).toBe('a')
  expect(s(0.4)).toBe('b')
  expect(s(0.6)).toBe('b')
  expect(s(0.8)).toBe('c')
  expect(s(1)).toBe('c')
})

test('createQuantize(options) respects non-zero domain starts.', () => {
  const s = createQuantize({
    domain: [10, 16],
    range: ['a', 'b', 'c']
  })

  expect(s(10)).toBe('a')
  expect(s(11.9)).toBe('a')
  expect(s(12)).toBe('b')
  expect(s(13.9)).toBe('b')
  expect(s(14)).toBe('c')
  expect(s(16)).toBe('c')
})
