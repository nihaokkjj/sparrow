import { expect, test } from 'vitest'
import { computeFlexViews } from '../../src/views/flex.js'

test('computeFlexViews for row distributes width with padding and flex ratios', () => {
  const box = { x: 0, y: 0, width: 400, height: 200 }
  const node = {
    type: 'row',
    padding: 20,
    flex: [2, 1],
    children: [{}, {}]
  }
  const [first, second] = computeFlexViews(box, node)
  expect(first.x).toBeCloseTo(0)
  expect(first.width).toBeCloseTo((400 - 20) * (2 / 3), 5)
  expect(first.y).toBe(0)
  expect(first.height).toBe(200)

  expect(second.x).toBeCloseTo(first.width + 20, 5)
  expect(second.width).toBeCloseTo((400 - 20) * (1 / 3), 5)
  expect(second.y).toBe(0)
  expect(second.height).toBe(200)
})

test('computeFlexViews for col stacks children vertically', () => {
  const box = { x: 0, y: 0, width: 300, height: 360 }
  const node = {
    type: 'col',
    padding: 10,
    flex: [1, 3],
    children: [{}, {}]
  }
  const [top, bottom] = computeFlexViews(box, node)
  expect(top.y).toBeCloseTo(0)
  expect(top.height).toBeCloseTo((360 - 10) * (1 / 4), 5)
  expect(top.x).toBe(0)
  expect(top.width).toBe(300)

  expect(bottom.y).toBeCloseTo(top.height + 10, 5)
  expect(bottom.height).toBeCloseTo((360 - 10) * (3 / 4), 5)
  expect(bottom.x).toBe(0)
  expect(bottom.width).toBe(300)
})
