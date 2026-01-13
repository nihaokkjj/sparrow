import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { point } from '../../src/geometry/point.js'
import { getAttributes, createDiv, mount } from '../utils.js'

test('point() renders circles using coordinate transform and channel styles', () => {
  const renderer = createRenderer(200, 200)
  const coordinate = ([x, y]) => [x + 5, y + 10]
  const channels = {
    x: [10, 50],
    y: [20, 70],
    r: [6, 12],
    fill: ['#ff4d4f', '#40a9ff'],
    stroke: ['#000', '#002766']
  }
  const nodes = point(
    renderer,
    [0, 1],
    {},
    channels,
    { strokeWidth: 2, fill: '#fff' },
    coordinate
  )

  mount(createDiv(), renderer.node())
  expect(nodes).toHaveLength(2)
  expect(
    getAttributes(nodes[0], ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'])
  ).toEqual({
    cx: '15',
    cy: '30',
    r: '6',
    fill: '#ff4d4f',
    stroke: '#000',
    'stroke-width': '2'
  })
  expect(
    getAttributes(nodes[1], ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'])
  ).toEqual({
    cx: '55',
    cy: '80',
    r: '12',
    fill: '#40a9ff',
    stroke: '#002766',
    'stroke-width': '2'
  })
})

test('point() falls back to default radius and fill when channel missing', () => {
  const renderer = createRenderer(100, 100)
  const nodes = point(renderer, [0], {}, { x: [20], y: [30] }, {}, (d) => d)

  mount(createDiv(), renderer.node())
  expect(getAttributes(nodes[0], ['cx', 'cy', 'r', 'fill'])).toEqual({
    cx: '20',
    cy: '30',
    r: '3',
    fill: 'none'
  })
})

test('point.channels() marks x/y as required and r optional', () => {
  const channels = point.channels()
  expect(channels.x.optional).toBe(false)
  expect(channels.y.optional).toBe(false)
  expect(channels.r.optional).toBe(true)
})
