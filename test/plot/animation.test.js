import { afterEach, expect, test, vi } from 'vitest'
import { normalizeAnimation } from '../../src/plot/animation.js'
import { renderAISpec } from '../../src/plot/renderAISpec.js'
import { renderPlotSpec } from '../../src/plot/renderPlotSpec.js'
import { createDiv } from '../utils.js'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

test('renderPlotSpec() autoplays mounted grow-y animations', async () => {
  const clock = installAnimationClock()
  const container = createDiv()
  container.id = 'plot-animation-mount'

  const result = renderPlotSpec({
    width: 240,
    height: 160,
    container: '#plot-animation-mount',
    animation: {
      preset: 'grow-y',
      duration: 48
    },
    plot: {
      data: [
        { month: 'Jan', sales: 12 },
        { month: 'Feb', sales: 18 }
      ],
      type: 'interval',
      encodings: {
        x: 'month',
        y: 'sales'
      }
    },
    guides: false
  })

  const mark = result.marks[0]
  expect(mark.getAttribute('height')).toBe('0')
  expect(mark.getAttribute('opacity')).toBe('0')

  await clock.advance(80)

  expect(Number(mark.getAttribute('height'))).toBeGreaterThan(0)
  expect(mark.getAttribute('opacity')).toBe('1')
})

test('renderPlotSpec() exposes manual animation playback when not mounted', async () => {
  const clock = installAnimationClock()

  const result = renderPlotSpec({
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
    animation: {
      preset: 'pop-in',
      duration: 48
    },
    guides: false
  })

  const mark = result.marks[0]
  const originalRadius = Number(mark.getAttribute('r'))

  expect(mark.getAttribute('opacity')).toBeNull()
  result.playAnimations()
  expect(mark.getAttribute('r')).toBe('0')
  expect(mark.getAttribute('opacity')).toBe('0')

  await clock.advance(80)

  expect(Number(mark.getAttribute('r'))).toBeCloseTo(originalRadius, 5)
  expect(mark.getAttribute('opacity')).toBe('1')
})

test('renderAISpec() defers leaf animations until the root svg is mounted', async () => {
  const clock = installAnimationClock()
  const container = createDiv()
  container.id = 'ai-animation-mount'

  const result = renderAISpec({
    width: 320,
    height: 180,
    container: '#ai-animation-mount',
    view: {
      type: 'layer',
      children: [
        {
          animation: {
            preset: 'pop-in',
            duration: 48
          },
          plot: {
            type: 'point',
            data: [
              { x: 0.25, y: 0.4 },
              { x: 0.65, y: 0.75 }
            ],
            encodings: { x: 'x', y: 'y' }
          },
          guides: false
        }
      ]
    }
  })

  const mark = result.marks[0]
  expect(mark.getAttribute('r')).toBe('0')
  expect(mark.getAttribute('opacity')).toBe('0')

  await clock.advance(80)

  expect(Number(mark.getAttribute('r'))).toBeGreaterThan(0)
  expect(mark.getAttribute('opacity')).toBe('1')
})

test('renderPlotSpec() sweeps pie sectors with tweened path updates', async () => {
  const clock = installAnimationClock()
  const container = createDiv()
  container.id = 'pie-animation-mount'

  const result = renderPlotSpec({
    width: 240,
    height: 240,
    container: '#pie-animation-mount',
    guides: false,
    plot: {
      type: 'pie',
      data: [
        { category: 'A', value: 30 },
        { category: 'B', value: 70 }
      ],
      encodings: {
        angle: 'value',
        fill: 'category'
      },
      animation: {
        preset: 'sweep-in',
        duration: 48
      }
    }
  })

  const mark = result.marks[0]
  const initialPath = mark.getAttribute('d')

  expect(mark.getAttribute('opacity')).toBe('0')

  await clock.advance(80)

  expect(mark.getAttribute('d')).not.toBe(initialPath)
  expect(mark.getAttribute('opacity')).toBe('1')
})

test('renderPlotSpec() draws line paths with stroke-dashoffset animation', async () => {
  const clock = installAnimationClock()
  const container = createDiv()
  container.id = 'line-animation-mount'

  const result = renderPlotSpec({
    width: 240,
    height: 160,
    container: '#line-animation-mount',
    guides: false,
    plot: {
      type: 'line',
      data: [
        { step: 'Q1', value: 12 },
        { step: 'Q2', value: 18 },
        { step: 'Q3', value: 15 }
      ],
      encodings: {
        x: 'step',
        y: 'value'
      },
      animation: {
        preset: 'draw-in',
        duration: 48
      }
    },
    scales: {
      x: { type: 'dot' }
    }
  })

  const mark = result.marks[0]

  expect(Number(mark.getAttribute('stroke-dashoffset'))).toBeGreaterThan(0)
  expect(mark.getAttribute('opacity')).toBe('0')

  await clock.advance(80)

  expect(mark.hasAttribute('stroke-dashoffset')).toBe(false)
  expect(mark.hasAttribute('stroke-dasharray')).toBe(false)
  expect(mark.getAttribute('opacity')).toBe('1')
})

test('renderPlotSpec() grows area paths from the baseline', async () => {
  const clock = installAnimationClock()
  const container = createDiv()
  container.id = 'area-animation-mount'

  const result = renderPlotSpec({
    width: 240,
    height: 160,
    container: '#area-animation-mount',
    guides: false,
    plot: {
      type: 'area',
      data: [
        { step: 'Q1', value: 12 },
        { step: 'Q2', value: 18 },
        { step: 'Q3', value: 15 }
      ],
      encodings: {
        x: 'step',
        y: 'value'
      },
      animation: {
        preset: 'grow-y',
        duration: 48
      }
    },
    scales: {
      x: { type: 'dot' }
    }
  })

  const mark = result.marks[0]
  const initialPath = mark.getAttribute('d')

  expect(mark.getAttribute('opacity')).toBe('0')

  await clock.advance(80)

  expect(mark.getAttribute('d')).not.toBe(initialPath)
  expect(mark.getAttribute('opacity')).toBe('1')
})

test('normalizeAnimation() accepts animation.enter.type as a preset alias', () => {
  expect(
    normalizeAnimation({
      enter: {
        type: 'sweep-in',
        duration: 320
      }
    })
  ).toEqual({
    enter: {
      preset: 'sweep-in',
      duration: 320,
      ease: 'easeOut',
      delay: 0,
      stagger: 0,
      offset: 16
    }
  })
})

test('normalizeAnimation() normalizes kebab-case ease names', () => {
  expect(
    normalizeAnimation({
      enter: {
        preset: 'draw-in',
        ease: 'ease-out'
      }
    })
  ).toEqual({
    enter: {
      preset: 'draw-in',
      duration: 600,
      ease: 'easeOut',
      delay: 0,
      stagger: 0,
      offset: 16
    }
  })
})

function installAnimationClock() {
  let now = 0

  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback) =>
    setTimeout(() => {
      now += 16
      callback(now)
    }, 16)
  )
  vi.stubGlobal('cancelAnimationFrame', (timerId) => clearTimeout(timerId))

  return {
    advance(ms) {
      return vi.advanceTimersByTimeAsync(ms)
    }
  }
}
