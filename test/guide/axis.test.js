import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { createCoordinate } from '../../src/coordinate/coordinate.js'
import { cartesian } from '../../src/coordinate/cartesian.js'
import { createBand } from '../../src/scale/band.js'
import { createLinear } from '../../src/scale/linear.js'
import { axisX } from '../../src/guide/axisX.js'
import { axisY } from '../../src/guide/axisY.js'

function createCartesianCoordinate() {
  return createCoordinate({
    x: 24,
    y: 16,
    width: 180,
    height: 100,
    transforms: [cartesian()]
  })
}

test('axisX() renders cartesian ticks, grid, and label', () => {
  const renderer = createRenderer(240, 160)
  const coordinate = createCartesianCoordinate()
  const scale = createBand({
    domain: ['Jan', 'Feb', 'Mar'],
    range: [0, 1],
    padding: 0.1
  })

  axisX(renderer, scale, coordinate, {
    domain: ['Jan', 'Feb', 'Mar'],
    label: 'Month',
    grid: true
  })

  const texts = Array.from(renderer.node().querySelectorAll('text')).map(
    (node) => node.textContent
  )

  expect(renderer.node().querySelectorAll('line').length).toBeGreaterThan(3)
  expect(texts).toContain('Jan')
  expect(texts.some((text) => text?.includes('Month'))).toBe(true)
})

test('axisY() renders cartesian ticks, grid, and label', () => {
  const renderer = createRenderer(240, 160)
  const coordinate = createCartesianCoordinate()
  const scale = createLinear({
    domain: [0, 100],
    range: [1, 0]
  })

  axisY(renderer, scale, coordinate, {
    label: 'Sales',
    grid: true,
    tickCount: 3
  })

  const texts = Array.from(renderer.node().querySelectorAll('text')).map(
    (node) => node.textContent
  )

  expect(renderer.node().querySelectorAll('line').length).toBeGreaterThan(3)
  expect(texts.some((text) => text?.includes('Sales'))).toBe(true)
  expect(texts.some((text) => text === '0' || text === '50' || text === '100')).toBe(true)
})

test('axisX() supports a top position in cartesian coordinates', () => {
  const renderer = createRenderer(240, 160)
  const coordinate = createCartesianCoordinate()
  const scale = createBand({
    domain: ['Jan', 'Feb', 'Mar'],
    range: [0, 1],
    padding: 0.1
  })

  axisX(renderer, scale, coordinate, {
    domain: ['Jan', 'Feb', 'Mar'],
    label: 'Month',
    position: 'top'
  })

  const firstTick = renderer.node().querySelector('line.tick')
  expect(Number(firstTick?.getAttribute('y2'))).toBeLessThan(
    Number(firstTick?.getAttribute('y1'))
  )
})

test('axisY() supports a right position in cartesian coordinates', () => {
  const renderer = createRenderer(240, 160)
  const coordinate = createCartesianCoordinate()
  const scale = createLinear({
    domain: [0, 100],
    range: [1, 0]
  })

  axisY(renderer, scale, coordinate, {
    label: 'Sales',
    tickCount: 3,
    position: 'right'
  })

  const firstTick = renderer.node().querySelector('line.tick')
  expect(Number(firstTick?.getAttribute('x2'))).toBeGreaterThan(
    Number(firstTick?.getAttribute('x1'))
  )
})
