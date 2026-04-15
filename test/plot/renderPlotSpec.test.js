import { expect, test } from 'vitest'
import { renderPlotSpec } from '../../src/plot/renderPlotSpec.js'
import { createDiv, getAttributes } from '../utils.js'

test('renderPlotSpec() renders a point chart and mounts its svg', () => {
  const container = createDiv()
  const result = renderPlotSpec(
    {
      width: 240,
      height: 160,
      data: [
        { x: 0.2, y: 0.25 },
        { x: 0.7, y: 0.65 }
      ],
      type: 'point',
      encodings: {
        x: 'x',
        y: 'y'
      },
      styles: {
        stroke: '#1677ff'
      }
    },
    { container }
  )

  expect(container.querySelector('svg')).toBe(result.node)
  expect(result.marks).toHaveLength(2)
  expect(result.scaleDescriptors.x.type).toBe('linear')
  expect(result.scaleDescriptors.y.type).toBe('linear')
  expect(result.node.querySelectorAll('circle')).toHaveLength(2)
  expect(result.node.querySelectorAll('text').length).toBeGreaterThan(0)
})

test('renderPlotSpec() defaults interval x to a band scale', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    plot: {
      data: [
        { month: 'Jan', sales: 12 },
        { month: 'Feb', sales: 18 }
      ],
      type: 'interval',
      encodings: {
        x: 'month',
        y: 'sales'
      },
      styles: {
        fill: '#5b8ff9'
      }
    },
    guides: false
  })

  expect(result.scaleDescriptors.x.type).toBe('band')
  expect(result.marks).toHaveLength(2)
  expect(Number(getAttributes(result.marks[0], ['width']).width)).toBeGreaterThan(0)
})

test('renderPlotSpec() supports wrapped line specs and disabled guides', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    plot: {
      data: [
        { x: 0.1, y: 0.2 },
        { x: 0.45, y: 0.55 },
        { x: 0.8, y: 0.35 }
      ],
      type: 'line',
      encodings: {
        x: 'x',
        y: 'y'
      },
      styles: {
        stroke: '#fa541c',
        strokeWidth: 2
      }
    },
    guides: false
  })

  expect(result.marks).toHaveLength(1)
  expect(result.node.querySelectorAll('path')).toHaveLength(1)
  expect(result.guideDescriptors).toEqual({})
})

test('renderPlotSpec() rejects multiple plots in the single-view runtime', () => {
  expect(() =>
    renderPlotSpec({
      plots: [
        {
          data: [{ x: 1, y: 2 }],
          type: 'point',
          encodings: { x: 'x', y: 'y' }
        },
        {
          data: [{ x: 2, y: 3 }],
          type: 'point',
          encodings: { x: 'x', y: 'y' }
        }
      ]
    })
  ).toThrowError('renderPlotSpec only supports a single plot.')
})
