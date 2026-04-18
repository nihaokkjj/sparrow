import { expect, test } from 'vitest'
import {
  AUTO_LAYOUT_SPACER_TYPE,
  buildNestedRowColView,
  choosePrimeGridLayout,
  distributeCountsSymmetrically
} from '../../src/plot/autoLayout.js'
import { renderAISpec } from '../../src/plot/renderAISpec.js'

test('distributeCountsSymmetrically() centers prime panel counts by row', () => {
  expect(distributeCountsSymmetrically(5, 3, 2)).toEqual([2, 1, 2])
  expect(distributeCountsSymmetrically(7, 3, 3)).toEqual([2, 3, 2])
  expect(distributeCountsSymmetrically(11, 3, 4)).toEqual([4, 3, 4])
})

test('choosePrimeGridLayout() prefers a balanced grid over a strip', () => {
  const layout = choosePrimeGridLayout({
    width: 640,
    height: 480,
    n: 6,
    gapX: 24,
    gapY: 24
  })

  expect(layout).toMatchObject({
    rows: 3,
    cols: 2,
    countsPerRow: [2, 2, 2]
  })
})

test('buildNestedRowColView() inserts spacer cells for short centered rows', () => {
  const layout = {
    rows: 3,
    cols: 2,
    countsPerRow: [2, 1, 2]
  }
  const children = Array.from({ length: 5 }, (_, index) => ({
    type: 'interval',
    data: [{ category: index, value: index + 1 }],
    encodings: { x: 'category', y: 'value' }
  }))

  const view = buildNestedRowColView(children, layout, {
    rowGap: 12,
    colGap: 12
  })

  expect(view.type).toBe('col')
  expect(view.children).toHaveLength(3)
  expect(view.children[1].children).toHaveLength(2)
  expect(
    view.children[1].children.some(
      (child) => child.type === AUTO_LAYOUT_SPACER_TYPE
    )
  ).toBe(true)
})

test('renderAISpec() auto-balances flat multi-panel strips into a grid', () => {
  const child = (offset) => ({
    type: 'interval',
    data: [
      { category: 'A', value: 10 + offset },
      { category: 'B', value: 18 + offset }
    ],
    encodings: { x: 'category', y: 'value' },
    scales: { y: { zero: true } }
  })

  const result = renderAISpec({
    width: 639,
    height: 480,
    view: {
      type: 'col',
      padding: 24,
      children: [0, 1, 2, 3, 4, 5].map(child)
    }
  })

  expect(result.views).toHaveLength(6)
  expect(result.view.type).toBe('col')
  expect(result.view.children).toHaveLength(3)
  expect(result.view.children.every((row) => row.type === 'row')).toBe(true)

  const xPositions = new Set(result.views.map(({ view }) => Math.round(view.x)))
  const yPositions = new Set(result.views.map(({ view }) => Math.round(view.y)))
  expect(xPositions.size).toBe(2)
  expect(yPositions.size).toBe(3)
})

test('renderAISpec() lets callers opt out of auto grid balancing', () => {
  const spec = {
    width: 639,
    height: 480,
    view: {
      type: 'col',
      padding: 24,
      autoLayout: false,
      children: Array.from({ length: 6 }, (_, index) => ({
        type: 'interval',
        data: [
          { category: 'A', value: 10 + index },
          { category: 'B', value: 18 + index }
        ],
        encodings: { x: 'category', y: 'value' },
        scales: { y: { zero: true } }
      }))
    }
  }

  expect(() => renderAISpec(spec)).toThrow(
    'renderPlotSpec requires a positive plot area.'
  )
})

test('renderAISpec() supports disabling auto layout via render options', () => {
  const spec = {
    width: 639,
    height: 480,
    view: {
      type: 'col',
      padding: 24,
      children: Array.from({ length: 6 }, (_, index) => ({
        type: 'interval',
        data: [
          { category: 'A', value: 10 + index },
          { category: 'B', value: 18 + index }
        ],
        encodings: { x: 'category', y: 'value' },
        scales: { y: { zero: true } }
      }))
    }
  }

  expect(() => renderAISpec(spec, { autoLayout: false })).toThrow(
    'renderPlotSpec requires a positive plot area.'
  )
})

test('renderAISpec() treats empty text view children as spacer placeholders', () => {
  const pie = (value) => ({
    type: 'pie',
    data: [
      { category: 'A', value },
      { category: 'B', value: 100 - value }
    ],
    encodings: {
      angle: 'value',
      fill: 'category'
    },
    guides: false
  })

  const result = renderAISpec({
    width: 640,
    height: 480,
    view: {
      type: 'col',
      padding: 16,
      children: [
        {
          type: 'row',
          padding: 16,
          children: [pie(28), pie(16), pie(25)]
        },
        {
          type: 'row',
          padding: 16,
          children: [pie(30), pie(12), pie(19)]
        },
        {
          type: 'row',
          padding: 16,
          children: [
            pie(35),
            {
              type: 'text',
              data: [{ label: '' }],
              encodings: { text: 'label' },
              guides: false
            },
            {
              type: 'text',
              data: [{ label: '' }],
              encodings: { text: 'label' },
              guides: false
            }
          ]
        }
      ]
    }
  })

  expect(result.views).toHaveLength(7)
  expect(result.view.children[2].children).toHaveLength(3)
  expect(
    result.view.children[2].children
      .slice(1)
      .every((child) => child.type === AUTO_LAYOUT_SPACER_TYPE)
  ).toBe(true)
})
