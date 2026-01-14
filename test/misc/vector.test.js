import { describe, expect, test } from 'vitest'
import {
  equal,
  closeTo,
  dist,
  sub,
  angleBetween,
  angle,
  degree,
  unique
} from '../../src/utils/vector.js'

describe('vector utils', () => {
  test('equal and closeTo use tolerance comparison', () => {
    expect(equal([1.000001, 2.000001], [1.000002, 2.000002])).toBe(true)
    expect(closeTo(1, 1.0001, 1e-5)).toBe(false)
  })

  test('dist and sub calculate vector operations', () => {
    expect(dist([3, 4])).toBe(5)
    expect(dist([3, 4], [1, 1])).toBeCloseTo(Math.sqrt(13))
    expect(sub([10, 5], [2, 1])).toEqual([8, 4])
  })

  test('angle helpers return radians and degrees', () => {
    expect(angle([0, 1])).toBeCloseTo(Math.PI / 2)
    expect(degree(Math.PI)).toBe(180)
    expect(angleBetween([1, 0], [0, 1])).toBeCloseTo(Math.PI / 2)
  })

  test('unique removes near-duplicate points', () => {
    const points = [
      [0, 0],
      [0.00000001, 0],
      [1, 1],
      [1, 1.00000001]
    ]
    expect(unique(points)).toEqual([
      [0, 0],
      [1, 1]
    ])
  })
})
