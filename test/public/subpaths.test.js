import { expect, test } from 'vitest'
import * as plot from '../../src/plot/index.js'
import * as guide from '../../src/guide/index.js'
import * as views from '../../src/views/index.js'

test('plot public barrel exposes plot composition APIs', () => {
  expect(plot.create).toBeTypeOf('function')
  expect(plot.register).toBeTypeOf('function')
  expect(plot.initialize).toBeTypeOf('function')
  expect(plot.inferGuides).toBeTypeOf('function')
  expect(plot.inferScales).toBeTypeOf('function')
  expect(plot.applyScales).toBeTypeOf('function')
  expect(plot.renderPlotSpec).toBeTypeOf('function')
  expect(plot.streamPlotSpec).toBeTypeOf('function')
  expect(plot.createOpenAICompatibleProvider).toBeTypeOf('function')
  expect(plot.createMockPlotProvider).toBeTypeOf('function')
  expect(plot.parsePlotSpecResponse).toBeTypeOf('function')
})

test('guide public barrel exposes axis and legend APIs', () => {
  expect(guide.axisX).toBeTypeOf('function')
  expect(guide.axisY).toBeTypeOf('function')
  expect(guide.legendRamp).toBeTypeOf('function')
  expect(guide.legendSwatches).toBeTypeOf('function')
})

test('views public barrel exposes the layout entry point', () => {
  expect(views.createViews).toBeTypeOf('function')
})
