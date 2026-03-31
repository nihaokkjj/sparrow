import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { interval } from '../../src/geometry/interval.js'
import { createDiv, getAttributes, mount } from '../utils.js'

test('interval() renders rects using band width when x1 is absent', () => {
  const renderer = createRenderer(200, 120)
  const nodes = interval(
    renderer,
    [0, 1],
    {
      x: { bandWidth: () => 20 }
    },
    {
      x: [10, 40],
      y: [20, 35],
      y1: [80, 90],
      fill: ['#1677ff', '#52c41a']
    },
    {
      stroke: '#111',
      strokeWidth: 2
    },
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(2)
  expect(
    getAttributes(nodes[0], ['x', 'y', 'width', 'height', 'fill', 'stroke'])
  ).toEqual({
    x: '10',
    y: '20',
    width: '20',
    height: '60',
    fill: '#1677ff',
    stroke: '#111'
  })
  expect(
    getAttributes(nodes[1], ['x', 'y', 'width', 'height', 'fill', 'stroke'])
  ).toEqual({
    x: '40',
    y: '35',
    width: '20',
    height: '55',
    fill: '#52c41a',
    stroke: '#111'
  })
})

test('interval() renders rects from x/x1 bounds and respects transposed coordinates', () => {
  const renderer = createRenderer(200, 120)
  const nodes = interval(
    renderer,
    [0],
    {},
    {
      x: [10],
      x1: [30],
      y: [20],
      y1: [80],
      fill: ['#fa541c']
    },
    {
      stroke: '#000'
    },
    ([x, y]) => [y, x]
  )

  mount(createDiv(), renderer.node())

  expect(getAttributes(nodes[0], ['x', 'y', 'width', 'height', 'fill'])).toEqual(
    {
      x: '20',
      y: '10',
      width: '60',
      height: '20',
      fill: '#fa541c'
    }
  )
})

test('interval() rejects polar coordinates until sector rendering is implemented', () => {
  const renderer = createRenderer(120, 80)
  const coordinate = Object.assign((d) => d, {
    isPolar: () => true
  })

  expect(() =>
    interval(
      renderer,
      [0],
      {
        x: { bandWidth: () => 10 }
      },
      {
        x: [10],
        y: [20],
        y1: [50]
      },
      {},
      coordinate
    )
  ).toThrowError('Geometry "interval" does not support polar coordinates yet.')
})

test('interval() requires x1 values when x does not use a band scale', () => {
  const renderer = createRenderer(120, 80)

  expect(() =>
    interval(
      renderer,
      [0],
      {},
      {
        x: [10],
        y: [20],
        y1: [50]
      },
      {},
      (d) => d
    )
  ).toThrowError('Interval geometry requires x1 values or an x band scale.')
})
