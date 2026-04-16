import { expect, test } from 'vitest'
import { applyPlaygroundAnimationPreference } from '../../src/plot/playgroundAnimationPreference.js'

test('applyPlaygroundAnimationPreference() strips animations when disabled', () => {
  const next = applyPlaygroundAnimationPreference(
    {
      animation: { enter: { preset: 'fade-in' } },
      view: {
        type: 'layer',
        children: [
          {
            plot: {
              type: 'interval',
              data: [{ category: 'A', value: 12 }],
              encodings: { x: 'category', y: 'value' },
              animation: { enter: { preset: 'grow-y' } }
            }
          }
        ]
      }
    },
    { enabled: false }
  )

  expect(next.animation).toBeUndefined()
  expect(next.view.children[0].plot.animation).toBeUndefined()
})

test('applyPlaygroundAnimationPreference() injects defaults when enabled', () => {
  const next = applyPlaygroundAnimationPreference(
    {
      plots: [
        {
          type: 'interval',
          data: [{ category: 'A', value: 12 }],
          encodings: { x: 'category', y: 'value' }
        },
        {
          type: 'point',
          data: [{ x: 0.2, y: 0.4 }],
          encodings: { x: 'x', y: 'y' }
        },
        {
          type: 'line',
          data: [{ step: 'Q1', value: 12 }],
          encodings: { x: 'step', y: 'value' }
        },
        {
          type: 'area',
          data: [{ step: 'Q1', value: 12 }],
          encodings: { x: 'step', y: 'value' }
        },
        {
          type: 'pie',
          data: [{ category: 'A', value: 12 }],
          encodings: { angle: 'value', fill: 'category' }
        }
      ]
    },
    { enabled: true }
  )

  expect(next.plots[0].animation.enter.preset).toBe('stagger-rise-in')
  expect(next.plots[1].animation.enter.preset).toBe('pop-in')
  expect(next.plots[2].animation.enter.preset).toBe('draw-in')
  expect(next.plots[3].animation.enter.preset).toBe('grow-y')
  expect(next.plots[4].animation.enter.preset).toBe('sweep-in')
})

test('applyPlaygroundAnimationPreference() injects animation for plots with inherited data', () => {
  const next = applyPlaygroundAnimationPreference(
    {
      data: [{ category: 'A', value: 12 }],
      plot: {
        type: 'interval',
        encodings: { x: 'category', y: 'value' }
      }
    },
    { enabled: true }
  )

  expect(next.plot.animation.enter.preset).toBe('stagger-rise-in')
})

test('applyPlaygroundAnimationPreference() injects animation for view leaf plots with inherited data', () => {
  const next = applyPlaygroundAnimationPreference(
    {
      data: [{ category: 'A', value: 12 }],
      view: {
        type: 'layer',
        children: [
          {
            plot: {
              type: 'interval',
              encodings: { x: 'category', y: 'value' }
            }
          }
        ]
      }
    },
    { enabled: true }
  )

  expect(next.view.children[0].plot.animation.enter.preset).toBe(
    'stagger-rise-in'
  )
})

test('applyPlaygroundAnimationPreference() strips animations from inherited-data plots when disabled', () => {
  const next = applyPlaygroundAnimationPreference(
    {
      data: [{ category: 'A', value: 12 }],
      plot: {
        type: 'interval',
        encodings: { x: 'category', y: 'value' },
        animation: { enter: { preset: 'stagger-rise-in' } }
      }
    },
    { enabled: false }
  )

  expect(next.plot.animation).toBeUndefined()
})

test('applyPlaygroundAnimationPreference() keeps explicit leaf animation', () => {
  const next = applyPlaygroundAnimationPreference(
    {
      plot: {
        type: 'text',
        data: [{ x: 0.5, y: 0.5, label: 'Hello' }],
        encodings: { x: 'x', y: 'y', text: 'label' },
        animation: { enter: { preset: 'fade-in', duration: 200 } }
      }
    },
    { enabled: true }
  )

  expect(next.plot.animation.enter.preset).toBe('fade-in')
  expect(next.plot.animation.enter.duration).toBe(200)
})
