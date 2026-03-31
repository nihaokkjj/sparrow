import { expect, test } from 'vitest'
import { initialize } from '../../src/plot/encoding.js'
import { interval } from '../../src/geometry/interval.js'
import { categoricalColors } from '../../src/plot/theme.js'

test('initialize() infers default baseline and fill styles for interval marks', () => {
  const initialized = initialize({
    data: [
      { category: 'A', value: 12 },
      { category: 'B', value: 18 }
    ],
    type: 'interval',
    encodings: {
      x: 'category',
      y: 'value'
    }
  })

  expect(initialized.geometry).toBe(interval)
  expect(initialized.channels.x.field).toBe('category')
  expect(initialized.channels.y.field).toBe('value')
  expect(initialized.channels.y1.values).toEqual([0, 0])
  expect(initialized.styles.fill).toBe(categoricalColors[0])
})
