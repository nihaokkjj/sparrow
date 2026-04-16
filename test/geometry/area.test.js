import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { area } from '../../src/geometry/area.js'
import { createDiv, getAttributes, mount } from '../utils.js'

test('area() renders a closed path from y to a y1 baseline', () => {
  const renderer = createRenderer(200, 120)
  const nodes = area(
    renderer,
    [0, 1, 2],
    {},
    {
      x: [10, 40, 70],
      y: [20, 10, 30],
      y1: [90, 90, 90],
      fill: ['#93c5fd', '#93c5fd', '#93c5fd']
    },
    {},
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(1)
  expect(getAttributes(nodes[0], ['d', 'fill', 'stroke'])).toEqual({
    d: 'M 10 20 L 40 10 L 70 30 L 70 90 L 40 90 L 10 90 Z',
    fill: '#93c5fd',
    stroke: 'none'
  })
  expect(nodes[0].getAttribute('data-sparrow-area-top')).toBe(
    JSON.stringify([
      [10, 20],
      [40, 10],
      [70, 30]
    ])
  )
  expect(nodes[0].getAttribute('data-sparrow-area-bottom')).toBe(
    JSON.stringify([
      [10, 90],
      [40, 90],
      [70, 90]
    ])
  )
})

test('area() renders one path per z group', () => {
  const renderer = createRenderer(200, 120)
  const nodes = area(
    renderer,
    [0, 1, 2, 3],
    {},
    {
      x: [10, 40, 10, 40],
      y: [20, 10, 30, 25],
      y1: [90, 90, 90, 90],
      z: ['A', 'A', 'B', 'B'],
      fill: ['#93c5fd', '#93c5fd', '#c4b5fd', '#c4b5fd']
    },
    {},
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(2)
  expect(getAttributes(nodes[0], ['fill']).fill).toBe('#93c5fd')
  expect(getAttributes(nodes[1], ['fill']).fill).toBe('#c4b5fd')
})
