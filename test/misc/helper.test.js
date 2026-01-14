import { describe, expect, test } from 'vitest'
import {
  identity,
  compose,
  curry,
  nice,
  map,
  assignDefined,
  defined
} from '../../src/utils/helper.js'

describe('helper utilities', () => {
  test('identity returns same value', () => {
    const obj = { foo: 'bar' }
    expect(identity(obj)).toBe(obj)
  })

  test('compose runs functions from left to right', () => {
    const double = (x) => x * 2
    const increment = (x) => x + 1
    const composed = compose(double, increment)
    expect(composed(3)).toBe(7)
  })

  test('curry supports partial application', () => {
    const sum = (a, b, c) => a + b + c
    const curried = curry(sum)
    expect(curried(1)(2)(3)).toBe(6)
    expect(curried(1, 2)(3)).toBe(6)
    expect(curried(1)(2, 3)).toBe(6)
  })

  test('nice uses provided interval helpers', () => {
    const interval = {
      floor: (x) => Math.floor(x / 10) * 10,
      ceil: (x) => Math.ceil(x / 10) * 10
    }
    expect(nice([12, 87], interval)).toEqual([10, 90])
  })

  test('map applies transform to object entries', () => {
    const result = map({ a: 1, b: 2 }, (value, key) => `${key}${value}`)
    expect(result).toEqual({ a: 'a1', b: 'b2' })
  })

  test('assignDefined copies only defined values', () => {
    const target = { a: 1 }
    assignDefined(target, { a: undefined, b: 2, c: null })
    expect(target).toEqual({ a: 1, b: 2, c: null })
  })

  test('defined filters undefined and NaN', () => {
    expect(defined(0)).toBe(true)
    expect(defined('')).toBe(true)
    expect(defined(undefined)).toBe(false)
    expect(defined(NaN)).toBe(false)
  })
})
