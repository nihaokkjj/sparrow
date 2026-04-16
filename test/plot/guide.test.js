import { expect, test } from 'vitest'
import { inferGuides, planGuideLayout } from '../../src/plot/guide.js'
import { renderPlotSpec } from '../../src/plot/renderPlotSpec.js'

test('planGuideLayout() stacks axis and legend padding on the same side', () => {
  const padding = planGuideLayout(
    {
      x: {
        type: 'linear',
        domain: [0, 100],
        label: 'Revenue'
      },
      color: {
        type: 'ordinal',
        domain: ['North', 'South', 'East'],
        label: 'Region'
      }
    },
    {
      isPolar: false,
      isTranspose: false
    },
    {
      x: { position: 'top', label: 'Revenue' },
      color: { position: 'top', label: 'Region' }
    }
  )

  expect(padding.top).toBeGreaterThan(80)
  expect(padding.right).toBe(0)
  expect(padding.bottom).toBe(0)
  expect(padding.left).toBe(0)
})

test('inferGuides() keeps legend optimization synchronous and only accepts fitting placements', () => {
  const guides = inferGuides(
    {
      color: {
        type: 'ordinal',
        domain: ['A', 'B', 'C', 'D'],
        label: 'Group'
      }
    },
    {
      frameX: 56,
      frameY: 24,
      frameWidth: 120,
      frameHeight: 96,
      outerWidth: 240,
      outerHeight: 180
    },
    {
      color: {}
    },
    {
      enabled: true,
      provider: {
        chat: async () => ({ content: '{"position":"bottom","x":0,"y":0}' })
      }
    }
  )

  expect(guides).not.toBeInstanceOf(Promise)
  expect(guides.color.position).toBe('right')
  expect(guides.color.orientation).toBe('vertical')
  expect(guides.color.x).toBeGreaterThanOrEqual(176)
  expect(
    guides.color.x + guides.color.estimatedSize.width
  ).toBeLessThanOrEqual(240)
})

test('renderPlotSpec() still renders guides when legend optimization is enabled', () => {
  const result = renderPlotSpec(
    {
      width: 240,
      height: 180,
      data: [
        { x: 0.15, y: 0.25, group: 'A' },
        { x: 0.35, y: 0.4, group: 'B' },
        { x: 0.6, y: 0.55, group: 'C' },
        { x: 0.8, y: 0.75, group: 'D' }
      ],
      type: 'point',
      encodings: {
        x: 'x',
        y: 'y',
        fill: 'group'
      },
      guides: {
        color: { label: 'Group' }
      }
    },
    {
      aiOptions: {
        enabled: true,
        provider: {
          chat: async () => ({ content: '{"position":"left","x":0,"y":0}' })
        }
      }
    }
  )

  expect(result.guideDescriptors).not.toBeInstanceOf(Promise)
  expect(result.guideDescriptors.color.orientation).toBe('vertical')
  expect(
    Array.from(result.node.querySelectorAll('text')).some((node) =>
      node.textContent?.includes('Group')
    )
  ).toBe(true)
})
