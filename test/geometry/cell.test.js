import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { cell } from '../../src/geometry/cell.js'
import { createDiv, getAttributes, mount } from '../utils.js'

test('cell() renders band-sized rectangles from x and y channels', () => {
  const renderer = createRenderer(200, 120)
  const nodes = cell(
    renderer,
    [0, 1],
    {
      x: { bandWidth: () => 20 },
      y: { bandWidth: () => 16 }
    },
    {
      x: [10, 40],
      y: [20, 50],
      fill: ['#93c5fd', '#c4b5fd']
    },
    {},
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(2)
  expect(
    getAttributes(nodes[0], ['x', 'y', 'width', 'height', 'fill'])
  ).toEqual({
    x: '10',
    y: '20',
    width: '20',
    height: '16',
    fill: '#93c5fd'
  })
  expect(getAttributes(nodes[1], ['fill']).fill).toBe('#c4b5fd')
})

test('cell() requires band scales on x and y', () => {
  const renderer = createRenderer(120, 80)

  expect(() =>
    cell(
      renderer,
      [0],
      {},
      {
        x: [10],
        y: [20]
      },
      {},
      (d) => d
    )
  ).toThrowError('x channel needs band scale.')
})
