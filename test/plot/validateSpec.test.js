import { expect, test } from 'vitest'
import {
  SparrowSpecValidationError,
  assertValidSparrowSpec,
  validateSparrowSpec
} from '../../src/plot/index.js'

test('validateSparrowSpec() accepts a valid layered plot spec', () => {
  const report = validateSparrowSpec({
    plots: [
      {
        type: 'area',
        data: [
          { month: 'Jan', value: 12 },
          { month: 'Feb', value: 18 }
        ],
        encodings: { x: 'month', y: 'value' }
      },
      {
        type: 'line',
        data: [
          { month: 'Jan', value: 12 },
          { month: 'Feb', value: 18 }
        ],
        encodings: { x: 'month', y: 'value' },
        animation: { enter: { preset: 'draw-in', ease: 'easeOut' } }
      }
    ],
    guides: {
      x: { position: 'bottom' },
      y: { position: 'left' }
    }
  })

  expect(report.valid).toBe(true)
  expect(report.errors).toHaveLength(0)
})

test('validateSparrowSpec() reports unsupported marks and forbidden mark keys', () => {
  const report = validateSparrowSpec({
    plot: {
      mark: 'bar',
      type: 'bar',
      data: [{ category: 'A', value: 1 }],
      encodings: { x: 'category', y: 'value' }
    }
  })

  expect(report.valid).toBe(false)
  expect(report.errors.map((error) => error.code)).toEqual(
    expect.arrayContaining(['mark_key', 'unsupported_mark'])
  )
})

test('validateSparrowSpec() accepts inherited data in facet children', () => {
  const report = validateSparrowSpec({
    view: {
      type: 'facet',
      data: [
        { region: 'East', month: 'Jan', sales: 45 },
        { region: 'West', month: 'Jan', sales: 38 }
      ],
      encodings: { x: 'region' },
      children: [
        {
          type: 'line',
          encodings: { x: 'month', y: 'sales' }
        }
      ]
    }
  })

  expect(report.valid).toBe(true)
})

test('validateSparrowSpec() catches nested view wrappers, pie encoding, guides, and animation errors', () => {
  const report = validateSparrowSpec({
    view: {
      type: 'row',
      children: [
        {
          view: {
            type: 'col',
            children: [
              {
                plot: {
                  type: 'pie',
                  data: [{ category: 'A', value: 10 }],
                  encodings: { value: 'value', fill: 'category' },
                  animation: {
                    enter: {
                      type: 'sweep-in',
                      ease: 'ease-out'
                    }
                  },
                  guides: {
                    x: { position: 'left' }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  })

  expect(report.valid).toBe(false)
  expect(report.errors.map((error) => error.code)).toEqual(
    expect.arrayContaining([
      'nested_view_wrapped',
      'pie_angle_encoding',
      'animation_enter_type',
      'animation_ease',
      'guide_position'
    ])
  )
})

test('assertValidSparrowSpec() throws structured validation errors', () => {
  expect(() =>
    assertValidSparrowSpec({
      plot: {
        type: 'line',
        encodings: { x: 'x', y: 'y' }
      }
    })
  ).toThrow(SparrowSpecValidationError)
})
