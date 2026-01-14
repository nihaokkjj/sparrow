import { expect, test } from 'vitest'
import { computeLayerViews } from '../../src/views/layer.js'

test('computeLayerViews copies parent box for every child', () => {
  const box = { x: 10, y: 5, width: 120, height: 80 }
  const node = { children: [{ id: 1 }, { id: 2 }, { id: 3 }] }

  const views = computeLayerViews(box, node)
  expect(views).toHaveLength(3)
  views.forEach((view) => {
    expect(view).toEqual(box)
    expect(view).not.toBe(box)
  })
})
