import { expect, test } from 'vitest'
import { median } from '../../src/utils/array.js'

test('median() sorts numerically before picking the middle value', () => {
  expect(median([1, 10, 2])).toBe(2)
  expect(median([1, 10, 2, 8])).toBe(5)
})
