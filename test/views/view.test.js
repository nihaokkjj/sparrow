import { expect, test } from 'vitest'
import { createViews } from '../../src/views/view.js'

test('createViews computes layout tree and groups nodes sharing same view', () => {
  const leftMark = { name: 'left-mark' }
  const rightMark = { name: 'right-mark' }
  const leftLayer = { type: 'layer', name: 'left-layer', children: [leftMark] }
  const rightLayer = {
    type: 'layer',
    name: 'right-layer',
    children: [rightMark]
  }
  const root = {
    type: 'row',
    width: 400,
    height: 200,
    x: 0,
    y: 0,
    children: [leftLayer, rightLayer]
  }

  const views = createViews(root)

  expect(views).toHaveLength(3)

  const rootGroup = views.find(([view]) => view.width === 400)
  expect(rootGroup[0]).toEqual({ x: 0, y: 0, width: 400, height: 200 })
  expect(rootGroup[1]).toEqual([root])

  const leftGroup = views.find(
    ([view]) => view.x === 0 && view.width === 180 && view.height === 200
  )
  expect(leftGroup[1]).toEqual(
    expect.arrayContaining([leftLayer, leftMark])
  )

  const rightGroup = views.find(
    ([view]) => view.x === 220 && view.width === 180 && view.height === 200
  )
  expect(rightGroup[1]).toEqual(
    expect.arrayContaining([rightLayer, rightMark])
  )
})
