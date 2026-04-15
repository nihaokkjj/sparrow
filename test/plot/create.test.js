import { expect, test } from 'vitest'
import { create, register } from '../../src/plot/create.js'
import { area } from '../../src/geometry/area.js'
import { cell } from '../../src/geometry/cell.js'
import { interval } from '../../src/geometry/interval.js'
import { line } from '../../src/geometry/line.js'
import { point } from '../../src/geometry/point.js'
import { rect } from '../../src/geometry/rect.js'
import { text } from '../../src/geometry/text.js'

test('create returns point geometry for point marks', () => {
  expect(create({ type: 'point' })).toBe(point)
})

test('create returns interval geometry for interval marks', () => {
  expect(create({ type: 'interval' })).toBe(interval)
})

test('create returns line geometry for line marks', () => {
  expect(create({ type: 'line' })).toBe(line)
})

test('create returns area geometry for area marks', () => {
  expect(create({ type: 'area' })).toBe(area)
})

test('create returns rect, cell, and text geometries', () => {
  expect(create({ type: 'rect' })).toBe(rect)
  expect(create({ type: 'cell' })).toBe(cell)
  expect(create({ type: 'text' })).toBe(text)
})

test('create throws a clear error for unsupported geometry marks', () => {
  expect(() => create({ type: 'link' })).toThrowError(
    'Geometry "link" is not implemented yet.'
  )
})

test('register adds custom node types and returns a restore function', () => {
  const restore = register('test-node', () => 'custom-node')

  expect(create({ type: 'test-node' })).toBe('custom-node')

  restore()

  expect(() => create({ type: 'test-node' })).toThrowError(
    'Unknown node type: test-node'
  )
})

test('register can temporarily override an existing type', () => {
  const restore = register('point', () => 'custom-point', { override: true })

  expect(create({ type: 'point' })).toBe('custom-point')

  restore()

  expect(create({ type: 'point' })).toBe(point)
})
