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
  expect(
    Number(getAttributes(result.marks[0], ['width']).width)
  ).toBeGreaterThan(0)
  expect(result.guideDescriptors.x.type).toBe('axisX')
  expect(result.guideDescriptors.y.type).toBe('axisY')
  expect(
    Array.from(result.node.querySelectorAll('text')).some((node) =>
      node.textContent?.includes('Month')
    )
  ).toBe(true)
})

test('renderPlotSpec() renders interval bars as polar sectors', () => {
  const result = renderPlotSpec({
    width: 240,
    height: 240,
    plot: {
      data: [
        { category: 'A', value: 3 },
        { category: 'B', value: 5 },
        { category: 'C', value: 4 }
      ],
      type: 'interval',
      encodings: {
        x: 'category',
        y: 'value'
      },
      styles: {
        fill: '#5b8ff9'
      }
    },
    coordinate: {
      type: 'polar'
    },
    scales: {
      y: { zero: true }
    },
    guides: false
  })

  expect(result.coordinate.isPolar()).toBe(true)
  expect(result.scaleDescriptors.x.type).toBe('band')
  expect(result.marks).toHaveLength(3)
  expect(result.node.querySelectorAll('rect')).toHaveLength(0)
  expect(result.node.querySelectorAll('path')).toHaveLength(3)
  expect(getAttributes(result.marks[0], ['d']).d).toContain('Z')
})

test('renderPlotSpec() renders pie marks as polar sectors with angle aliases', () => {
  const result = renderPlotSpec({
    width: 240,
    height: 240,
    plot: {
      data: [
        { category: 'A', value: 3 },
        { category: 'B', value: 5 },
        { category: 'C', value: 4 }
      ],
      type: 'pie',
      encodings: {
        value: 'value',
        fill: 'category'
      }
    }
  })

  expect(result.plot.type).toBe('pie')
  expect(result.coordinate.isPolar()).toBe(true)
  expect(result.scaleDescriptors.angle.type).toBe('identity')
  expect(result.scaleDescriptors.color.type).toBe('ordinal')
  expect(result.plot.channels.angle.field).toBe('value')
  expect(result.marks).toHaveLength(3)
  expect(Array.from(result.marks, (node) => node.tagName)).toEqual([
    'path',
    'path',
    'path'
  ])
  expect(result.node.querySelectorAll('path')).toHaveLength(3)
  expect(getAttributes(result.marks[0], ['d']).d).toContain('Z')
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
  expect(
    Array.from(result.node.querySelectorAll('text')).some((node) =>
      node.textContent?.includes('Group')
    )
  ).toBe(true)
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
  expect(
    Array.from(result.node.querySelectorAll('text')).some((node) =>
      node.textContent?.includes('X Axis')
    )
  ).toBe(true)
})

test('renderPlotSpec() renders an area chart path with a zero baseline', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    plot: {
      data: [
        { quarter: 'Q1', value: 12 },
        { quarter: 'Q2', value: 18 },
        { quarter: 'Q3', value: 15 }
      ],
      type: 'area',
      encodings: {
        x: 'quarter',
        y: 'value',
        fill: '#93c5fd'
      },
      styles: {
        opacity: 0.8
      }
    },
    scales: {
      x: { type: 'dot' },
      y: { zero: true }
    },
    guides: false
  })

  expect(result.plot.type).toBe('area')
  expect(result.marks).toHaveLength(1)
  expect(result.node.querySelectorAll('path')).toHaveLength(1)

  const attributes = getAttributes(result.marks[0], ['d', 'fill', 'stroke'])
  expect(attributes.d).toContain('M')
  expect(attributes.d).toContain('L')
  expect(attributes.d).toContain('Z')
  expect(attributes.fill).toBe('#93c5fd')
  expect(attributes.stroke).toBe('none')
})

test('renderPlotSpec() renders rect marks from explicit bounds', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    data: [
      { x0: 0, x1: 2, y0: 0, y1: 4, fill: '#93c5fd' },
      { x0: 2, x1: 4, y0: 1, y1: 5, fill: '#c4b5fd' }
    ],
    type: 'rect',
    encodings: {
      x: 'x0',
      x1: 'x1',
      y: 'y0',
      y1: 'y1',
      fill: 'fill'
    },
    guides: false
  })

  expect(result.plot.type).toBe('rect')
  expect(result.marks).toHaveLength(2)
  expect(result.node.querySelectorAll('rect')).toHaveLength(2)
  expect(
    Number(getAttributes(result.marks[0], ['width']).width)
  ).toBeGreaterThan(0)
})

test('renderPlotSpec() renders cell marks with inferred band scales', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    data: [
      { column: 'A', row: 'North', value: 'low' },
      { column: 'B', row: 'North', value: 'high' },
      { column: 'A', row: 'South', value: 'high' },
      { column: 'B', row: 'South', value: 'low' }
    ],
    type: 'cell',
    encodings: {
      x: 'column',
      y: 'row',
      fill: 'value'
    },
    guides: false
  })

  expect(result.scaleDescriptors.x.type).toBe('band')
  expect(result.scaleDescriptors.y.type).toBe('band')
  expect(result.scaleDescriptors.color.type).toBe('ordinal')
  expect(result.marks).toHaveLength(4)
  expect(result.node.querySelectorAll('rect')).toHaveLength(4)
})

test('renderPlotSpec() renders text marks without scaling label text', () => {
  const result = renderPlotSpec({
    width: 260,
    height: 180,
    data: [
      { x: 0.2, y: 0.3, label: 'Alpha' },
      { x: 0.7, y: 0.6, label: 'Beta' }
    ],
    type: 'text',
    encodings: {
      x: 'x',
      y: 'y',
      text: 'label'
    },
    styles: {
      fill: '#0f172a',
      textAnchor: 'middle'
    },
    guides: false
  })

  const labels = Array.from(result.node.querySelectorAll('text')).map(
    (node) => node.textContent
  )

  expect(result.scaleDescriptors.text.type).toBe('identity')
  expect(result.plot.values.text).toEqual(['Alpha', 'Beta'])
  expect(result.marks).toHaveLength(2)
  expect(labels).toEqual(['Alpha', 'Beta'])
  expect(getAttributes(result.marks[0], ['fill', 'text-anchor'])).toEqual({
    fill: '#0f172a',
    'text-anchor': 'middle'
  })
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
      type: 'link',
      encodings: { x: 'x', y: 'y' }
    })
  ).toThrowError(
    'renderPlotSpec only supports point, line, interval, pie, area, rect, cell, and text marks. Received "link".'
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
