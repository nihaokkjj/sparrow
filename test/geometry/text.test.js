import { expect, test } from 'vitest'
import { createRenderer } from '../../src/renderer/renderer.js'
import { text } from '../../src/geometry/text.js'
import { createDiv, getAttributes, mount } from '../utils.js'

test('text() renders SVG text at transformed x and y positions', () => {
  const renderer = createRenderer(200, 120)
  const nodes = text(
    renderer,
    [0, 1],
    {},
    {
      x: [10, 40],
      y: [20, 50],
      text: ['A', 'B'],
      fill: ['#0f172a', '#334155']
    },
    {
      textAnchor: 'middle'
    },
    (d) => d
  )

  mount(createDiv(), renderer.node())

  expect(nodes).toHaveLength(2)
  expect(getAttributes(nodes[0], ['x', 'y', 'fill', 'text-anchor'])).toEqual({
    x: '10',
    y: '20',
    fill: '#0f172a',
    'text-anchor': 'middle'
  })
  expect(nodes[0].textContent).toBe('A')
  expect(nodes[1].textContent).toBe('B')
})
