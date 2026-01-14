import { expect, test } from 'vitest'
import { computeFacetViews } from '../../src/views/facet.js'

test('computeFacetViews splits data by encodings and applies transform filters', () => {
  const data = [
    { region: 'Asia', category: 'Fruit', value: 10 },
    { region: 'Asia', category: 'Vegetable', value: 20 },
    { region: 'Europe', category: 'Fruit', value: 30 },
    { region: 'Europe', category: 'Vegetable', value: 40 }
  ]
  const box = { x: 0, y: 0, width: 400, height: 400 }
  const views = computeFacetViews(box, {
    data,
    encodings: { x: 'region', y: 'category' },
    padding: 10,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0
  })

  expect(views).toHaveLength(4)
  const [asiaFruit] = views
  expect(asiaFruit).toMatchObject({
    x: 0,
    y: 0,
    width: (400 - 10) / 2,
    height: (400 - 10) / 2
  })
  expect(asiaFruit.transform(data)).toEqual([
    { region: 'Asia', category: 'Fruit', value: 10 }
  ])

  const europeVegetable = views.find((view) => {
    const filtered = view.transform(data)
    return (
      filtered.length === 1 &&
      filtered[0].region === 'Europe' &&
      filtered[0].category === 'Vegetable'
    )
  })

  expect(europeVegetable).toBeDefined()
  expect(europeVegetable.x).toBeCloseTo(205) // second column: 10 padding + 195 width
  expect(europeVegetable.y).toBeCloseTo(205) // second row
})
