import { expect, test } from 'vitest'
import { inferScales, applyScales } from '../../src/plot/plot.js'
import { interpolateNumber } from '../../src/scale/linear.js'
import { categoricalColors } from '../../src/plot/theme.js'

test('inferScales infers numeric and ordinal scales with merged color channels', () => {
  const channels = [
    {
      x: { name: 'x', values: [0, 10, 20], field: 'value' }
    },
    {
      fill: {
        name: 'fill',
        values: ['A', 'B', 'A'],
        field: 'category'
      },
      stroke: {
        name: 'stroke',
        values: ['B', 'C'],
        field: 'category'
      }
    }
  ]

  const scales = inferScales(channels, {
    x: { range: [0, 500] }
  })

  expect(scales.x.type).toBe('linear')
  expect(scales.x.domain).toEqual([0, 20])
  expect(scales.x.range).toEqual([0, 500])
  expect(scales.x.interpolate).toBe(interpolateNumber)
  expect(scales.x.label).toBe('value')

  expect(scales.color.type).toBe('ordinal')
  expect(scales.color.domain).toEqual(['A', 'B', 'C'])
  expect(scales.color.range).toBe(categoricalColors)
  expect(scales.color.label).toBe('category')
})

test('inferScales treats ordinal position channels as dot scales', () => {
  const channels = [
    {
      x: { name: 'x', values: ['Mon', 'Tue', 'Wed'], field: 'weekday' }
    }
  ]

  const scales = inferScales(channels, {})
  expect(scales.x.type).toBe('dot')
  expect(scales.x.domain).toEqual(['Mon', 'Tue', 'Wed'])
  expect(scales.x.range).toEqual([0, 1])
})

test('applyScales maps every channel through its normalized scale', () => {
  const channels = {
    x: { name: 'x', values: [1, 2, 3] },
    fill: { name: 'fill', values: ['a', 'b'] }
  }
  const result = applyScales(channels, {
    x: (v) => v * 10,
    color: (v) => v.toUpperCase()
  })

  expect(result.x).toEqual([10, 20, 30])
  expect(result.fill).toEqual(['A', 'B'])
})
