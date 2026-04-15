import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { rect } from '../../src/geometry/rect.js'
import { createDiv, getAttributes, mount } from '../utils.js'

test('rect() renders rectangles from x/x1/y/y1 bounds', () => {
  const renderer = createRenderer(200, 120)
  const nodes = rect(
    renderer,
    [0],
    {},
    {
      x: [10],
      x1: [40],
      y: [20],
      y1: [80],
      fill: ['#93c5fd']
    },
    {
      stroke: '#0f172a'
    },
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(1)
  expect(
    getAttributes(nodes[0], ['x', 'y', 'width', 'height', 'fill'])
  ).toEqual({
    x: '10',
    y: '20',
    width: '30',
    height: '60',
    fill: '#93c5fd'
  })
})

test('rect() rejects polar coordinates until sector rendering is implemented', () => {
  const renderer = createRenderer(120, 80)
  const coordinate = Object.assign((d) => d, {
    isPolar: () => true
  })

  expect(() =>
    rect(
      renderer,
      [0],
      {},
      {
        x: [10],
        x1: [40],
        y: [20],
        y1: [80]
      },
      {},
      coordinate
    )
  ).toThrowError('Geometry "rect" does not support polar coordinates yet.')
})
