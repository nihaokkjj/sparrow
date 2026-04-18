import { expect, test } from 'vitest'
import { computeFlexViews } from '../../src/views/flex.js'
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
  const [leftView, rightView] = computeFlexViews(
    { x: 0, y: 0, width: 400, height: 200 },
    root
  )

  expect(views).toHaveLength(3)

  const rootGroup = views.find(([view]) => view.width === 400)
  expect(rootGroup[0]).toEqual({ x: 0, y: 0, width: 400, height: 200 })
  expect(rootGroup[1]).toEqual([root])

  const leftGroup = views.find(
    ([view]) =>
      view.x === leftView.x &&
      view.width === leftView.width &&
      view.height === leftView.height
  )
  expect(leftGroup[1]).toEqual(
    expect.arrayContaining([leftLayer, leftMark])
  )

  const rightGroup = views.find(
    ([view]) =>
      view.x === rightView.x &&
      view.width === rightView.width &&
      view.height === rightView.height
  )
  expect(rightGroup[1]).toEqual(
    expect.arrayContaining([rightLayer, rightMark])
  )
})
