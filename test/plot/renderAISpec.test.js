import { expect, test } from 'vitest'
import { renderAISpec } from '../../src/plot/renderAISpec.js'

test('renderAISpec() renders nested row and col view layouts', () => {
  const result = renderAISpec({
    width: 600,
    height: 300,
    view: {
      type: 'row',
      padding: 20,
      children: [
        {
          plot: {
            type: 'interval',
            data: [
              { category: 'A', value: 3 },
              { category: 'B', value: 5 }
            ],
            encodings: { x: 'category', y: 'value' },
            styles: { fill: '#3382f6' }
          },
          scales: {
            y: { zero: true }
          },
          guides: false
        },
        {
          type: 'col',
          padding: 12,
          children: [
            {
              plot: {
                type: 'point',
                data: [
                  { x: 1, y: 2 },
                  { x: 2, y: 4 }
                ],
                encodings: { x: 'x', y: 'y' },
                styles: { fill: '#7c3aed' }
              },
              guides: false
            },
            {
              plot: {
                type: 'line',
                data: [
                  { month: 'Jan', value: 10 },
                  { month: 'Feb', value: 16 },
                  { month: 'Mar', value: 13 }
                ],
                encodings: { x: 'month', y: 'value' },
                styles: { stroke: '#16a34a', strokeWidth: 2 }
              },
              scales: {
                x: { type: 'dot' },
                y: { zero: true }
              },
              guides: false
            }
          ]
        }
      ]
    }
  })

  expect(result.views).toHaveLength(3)
  expect(result.marks).toHaveLength(5)
  expect(result.views[0].view).toMatchObject({
    x: 0,
    y: 0,
    width: 290,
    height: 300
  })
  expect(result.views[1].view.height).toBeCloseTo(144, 5)
  expect(result.views[2].result.plot.type).toBe('line')
})

test('renderAISpec() facets inherited data into child plot specs', () => {
  const data = [
    { region: 'Asia', category: 'Fruit', value: 10 },
    { region: 'Asia', category: 'Vegetable', value: 20 },
    { region: 'Europe', category: 'Fruit', value: 30 },
    { region: 'Europe', category: 'Vegetable', value: 40 }
  ]

  const result = renderAISpec({
    width: 400,
    height: 400,
    view: {
      type: 'facet',
      data,
      encodings: { x: 'region', y: 'category' },
      padding: 10,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      children: [
        {
          plot: {
            type: 'interval',
            encodings: { x: 'category', y: 'value' },
            styles: { fill: '#3382f6' }
          },
          scales: {
            y: { zero: true }
          },
          guides: false
        }
      ]
    }
  })

  expect(result.views).toHaveLength(4)
  expect(result.marks).toHaveLength(4)
  result.views.forEach(({ spec }) => {
    expect(spec.plot.data).toHaveLength(1)
  })
  expect(result.views[0].view).toMatchObject({
    x: 0,
    y: 0,
    width: (400 - 10) / 2,
    height: (400 - 10) / 2
  })
})
