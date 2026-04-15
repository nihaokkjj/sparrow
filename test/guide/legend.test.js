import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { createOrdinal } from '../../src/scale/ordinal.js'
import {
  createLinear,
  interpolateColor
} from '../../src/scale/linear.js'
import { legendRamp } from '../../src/guide/legendRamp.js'
import { legendSwatches } from '../../src/guide/legendSwatches.js'

test('legendSwatches() renders swatches and labels', () => {
  const renderer = createRenderer(240, 160)
  const scale = createOrdinal({
    domain: ['A', 'B'],
    range: ['#1677ff', '#13c2c2']
  })

  legendSwatches(renderer, scale, null, {
    x: 12,
    y: 16,
    domain: ['A', 'B'],
    label: 'Group'
  })

  const texts = Array.from(renderer.node().querySelectorAll('text')).map(
    (node) => node.textContent
  )

  expect(renderer.node().querySelectorAll('rect')).toHaveLength(2)
  expect(texts).toContain('A')
  expect(texts).toContain('B')
  expect(texts).toContain('Group')
})

test('legendRamp() renders a gradient ramp with ticks and label', () => {
  const renderer = createRenderer(240, 160)
  const scale = createLinear({
    domain: [0, 100],
    range: ['#000000', '#ffffff'],
    interpolate: interpolateColor
  })

  legendRamp(renderer, scale, null, {
    x: 12,
    y: 16,
    width: 8,
    height: 6,
    domain: [0, 100],
    tickCount: 3,
    label: 'Score'
  })

  const texts = Array.from(renderer.node().querySelectorAll('text')).map(
    (node) => node.textContent
  )

  expect(renderer.node().querySelectorAll('line').length).toBeGreaterThan(8)
  expect(texts).toContain('Score')
  expect(texts.some((text) => text === '0' || text === '50' || text === '100')).toBe(true)
})
