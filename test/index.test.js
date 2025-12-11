import { hello } from '../src'

import { expect, test } from 'vitest'

test('hello', () => {
  expect(hello()).toBe('hello')
})
