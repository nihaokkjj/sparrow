import { expect, test } from 'vitest'
import { renderPlotSpec } from '../../src/plot/renderPlotSpec.js'
import { createDiv, getAttributes } from '../utils.js'

test('renderPlotSpec() renders interval bars with a derived band scale', () => {
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
    guides: {
      x: { label: 'Month' },
      y: { label: 'Sales', grid: true }
    }
  })

  expect(result.scaleDescriptors.x.type).toBe('band')
  expect(result.scaleDescriptors.y.type).toBe('linear')
  expect(result.marks).toHaveLength(2)
  expect(result.node.querySelectorAll('rect')).toHaveLength(2)
  expect(Number(getAttributes(result.marks[0], ['width']).width)).toBeGreaterThan(0)
  expect(result.guideDescriptors.x.type).toBe('axisX')
  expect(result.guideDescriptors.y.type).toBe('axisY')
  expect(Array.from(result.node.querySelectorAll('text')).some((node) => node.textContent?.includes('Month'))).toBe(true)
})

test('renderPlotSpec() renders point scatter marks with scaled channels', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    data: [
      { x: 0.2, y: 0.25, fill: '#1677ff', r: 4 },
      { x: 0.7, y: 0.65, fill: '#13c2c2', r: 6 }
    ],
    type: 'point',
    encodings: {
      x: 'x',
      y: 'y',
      fill: 'fill',
      r: 'r'
    },
    guides: {
      x: { label: 'X Axis' },
      y: { label: 'Y Axis' },
      color: { label: 'Group' }
    }
  })

  expect(result.scaleDescriptors.x.type).toBe('linear')
  expect(result.scaleDescriptors.y.type).toBe('linear')
  expect(result.scaleDescriptors.color.type).toBe('ordinal')
  expect(result.marks).toHaveLength(2)
  expect(result.node.querySelectorAll('circle')).toHaveLength(2)
  expect(result.plot.values.r).toEqual([0, 1])
  expect(getAttributes(result.marks[1], ['fill', 'r']).fill).toBeTruthy()
  expect(Number(getAttributes(result.marks[1], ['fill', 'r']).r)).toBe(1)
  expect(result.guideDescriptors.color.type).toBe('legendSwatches')
  expect(result.node.querySelectorAll('rect').length).toBeGreaterThan(0)
  expect(Array.from(result.node.querySelectorAll('text')).some((node) => node.textContent?.includes('Group'))).toBe(true)
})

test('renderPlotSpec() renders a line chart path from wrapped plot specs', () => {
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
    guides: {
      x: { label: 'X Axis' },
      y: { label: 'Y Axis', grid: true }
    }
  })

  expect(result.marks).toHaveLength(1)
  expect(result.node.querySelectorAll('path')).toHaveLength(1)
  expect(getAttributes(result.marks[0], ['d']).d).toContain('M')
  expect(getAttributes(result.marks[0], ['d']).d).toContain('L')
  expect(result.guideDescriptors.x.type).toBe('axisX')
  expect(result.guideDescriptors.y.type).toBe('axisY')
  expect(Array.from(result.node.querySelectorAll('text')).some((node) => node.textContent?.includes('X Axis'))).toBe(true)
})

test('renderPlotSpec() mounts the svg into the configured container', () => {
  const container = createDiv()
  container.id = 'plot-mount'
  container.innerHTML = '<span>placeholder</span>'

  const result = renderPlotSpec({
    width: 240,
    height: 160,
    container: '#plot-mount',
    data: [
      { x: 0.2, y: 0.25 },
      { x: 0.7, y: 0.65 }
    ],
    type: 'point',
    encodings: {
      x: 'x',
      y: 'y'
    },
    guides: false
  })

  expect(container.children).toHaveLength(1)
  expect(container.querySelector('svg')).toBe(result.node)
})

test('renderPlotSpec() rejects unsupported marks', () => {
  expect(() =>
    renderPlotSpec({
      data: [{ x: 1, y: 2 }],
      type: 'area',
      encodings: { x: 'x', y: 'y' }
    })
  ).toThrowError(
    'renderPlotSpec only supports point, line, and interval marks. Received "area".'
  )
})

test('renderPlotSpec() renders multiple plots as layered marks', () => {
  const data = [
    { quarter: 'Q1', growth: 5 },
    { quarter: 'Q2', growth: 9 },
    { quarter: 'Q3', growth: 14 },
    { quarter: 'Q4', growth: 18 }
  ]

  const result = renderPlotSpec({
    width: 320,
    height: 220,
    data,
    plots: [
      {
        type: 'line',
        encodings: { x: 'quarter', y: 'growth' },
        styles: { stroke: '#3382f6', strokeWidth: 2 }
      },
      {
        type: 'point',
        encodings: { x: 'quarter', y: 'growth' },
        styles: { fill: '#3382f6', stroke: '#ffffff' }
      }
    ],
    scales: {
      x: { type: 'dot' },
      y: { zero: true }
    },
    guides: false
  })

  expect(result.plots).toHaveLength(2)
  expect(result.plot.type).toBe('line')
  expect(result.marks).toHaveLength(5)
  expect(result.node.querySelectorAll('path')).toHaveLength(1)
  expect(result.node.querySelectorAll('circle')).toHaveLength(4)
  expect(result.scaleDescriptors.x.domain).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
})
