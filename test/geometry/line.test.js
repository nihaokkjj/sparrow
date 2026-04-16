import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { line } from '../../src/geometry/line.js'
import { createDiv, getAttributes, mount } from '../utils.js'

test('line() renders one path per series and applies channel stroke styles', () => {
  const renderer = createRenderer(200, 120)
  const coordinate = ([x, y]) => [x + 5, y + 10]
  const nodes = line(
    renderer,
    [0, 1, 2, 3],
    {},
    {
      x: [10, 20, 15, 25],
      y: [20, 30, 40, 35],
      z: ['A', 'A', 'B', 'B'],
      stroke: ['#1677ff', '#1677ff', '#fa541c', '#fa541c']
    },
    {
      strokeWidth: 2
    },
    coordinate
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(2)
  expect(
    getAttributes(nodes[0], ['d', 'fill', 'stroke', 'stroke-width'])
  ).toEqual({
    d: 'M 15 30 L 25 40',
    fill: 'none',
    stroke: '#1677ff',
    'stroke-width': '2'
  })
  expect(Number(nodes[0].getAttribute('data-sparrow-path-length'))).toBeCloseTo(
    Math.hypot(10, 10),
    5
  )
  expect(
    getAttributes(nodes[1], ['d', 'fill', 'stroke', 'stroke-width'])
  ).toEqual({
    d: 'M 20 50 L 30 45',
    fill: 'none',
    stroke: '#fa541c',
    'stroke-width': '2'
  })
  expect(Number(nodes[1].getAttribute('data-sparrow-path-length'))).toBeCloseTo(
    Math.hypot(10, -5),
    5
  )
})

test('line() skips series with fewer than two defined points', () => {
  const renderer = createRenderer(120, 80)
  const nodes = line(
    renderer,
    [0, 1, 2],
    {},
    {
      x: [10, undefined, undefined],
      y: [20, 30, 40]
    },
    {
      stroke: '#000'
    },
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toEqual([])
})

test('line.channels() marks x/y as required and z optional', () => {
  const channels = line.channels()

  expect(channels.x.optional).toBe(false)
  expect(channels.y.optional).toBe(false)
  expect(channels.z.optional).toBe(true)
})
