import { area } from '../geometry/area.js'
import { cell } from '../geometry/cell.js'
import { interval } from '../geometry/interval.js'
import { line } from '../geometry/line.js'
import { pie } from '../geometry/pie.js'
import { point } from '../geometry/point.js'
import { rect } from '../geometry/rect.js'
import { text } from '../geometry/text.js'
import {
  createBand,
  createIdentity,
  createLinear,
  createLog,
  createOrdinal,
  createPoint,
  createQuantile,
  createQuantize,
  createThreshold,
  createTime
} from '../scale'
import { axisX, axisY, legendRamp, legendSwatches } from '../guide'
import { cartesian, transpose, polar } from '../coordinate'
import {
  createBinX,
  createNormalizeY,
  createSymmetryY,
  createStackY
} from '../statistic'

const registry = new Map()

const unsupportedGeometryTypes = ['link', 'path']

registerBuiltIn('area', () => area)
registerBuiltIn('cell', () => cell)
registerBuiltIn('point', () => point)
registerBuiltIn('interval', () => interval)
registerBuiltIn('line', () => line)
registerBuiltIn('pie', () => pie)
registerBuiltIn('rect', () => rect)
registerBuiltIn('text', () => text)

for (const type of unsupportedGeometryTypes) {
  registerBuiltIn(type, () => {
    throw new Error(`Geometry "${type}" is not implemented yet.`)
  })
}

registerBuiltIn('facet', () => {
  const facet = () => {}
  facet.channels = () => ({
    x: { name: 'x', optional: true },
    y: { name: 'y', optional: true }
  })
  return facet
})

registerBuiltIn('stackY', (options) => createStackY(options))
registerBuiltIn('normalizeY', (options) => createNormalizeY(options))
registerBuiltIn('symmetryY', (options) => createSymmetryY(options))
registerBuiltIn('binX', (options) => createBinX(options))

registerBuiltIn('cartesian', (options) => cartesian(options))
registerBuiltIn('transpose', (options) => transpose(options))
registerBuiltIn('polar', (options) => polar(options))

registerBuiltIn('band', (options) => createBand(options))
registerBuiltIn('linear', (options) => createScaleQ(createLinear, options))
registerBuiltIn('time', (options) => createScaleQ(createTime, options))
registerBuiltIn('log', (options) => createScaleQ(createLog, options))
registerBuiltIn('identity', (options) => createIdentity(options))
registerBuiltIn('ordinal', (options) => createOrdinal(options))
registerBuiltIn('dot', (options) => createPoint(options))
registerBuiltIn('quantile', (options) => createQuantile(options))
registerBuiltIn('quantize', (options) => createQuantize(options))
registerBuiltIn('threshold', (options) => createThreshold(options))

registerBuiltIn('axisX', (options) => createGuide(axisX, options))
registerBuiltIn('axisY', (options) => createGuide(axisY, options))
registerBuiltIn('legendSwatches', (options) =>
  createGuide(legendSwatches, options)
)
registerBuiltIn('legendRamp', (options) => createGuide(legendRamp, options))

export function create(options) {
  if (typeof options === 'function') return options
  const { type, ...rest } = options
  const factory = registry.get(type)
  if (factory) return factory(rest)

  throw new Error(`Unknown node type: ${options.type}`)
}

export function register(type, factory, { override = false } = {}) {
  if (!override && registry.has(type)) {
    throw new Error(`Type "${type}" is already registered.`)
  }

  const previous = registry.get(type)
  registry.set(type, factory)

  return () => {
    if (previous) registry.set(type, previous)
    else registry.delete(type)
  }
}

function createGuide(guide, options) {
  return (renderer, scale, coordinate) =>
    guide(renderer, scale, coordinate, options)
}

function createScaleQ(ctor, options) {
  const { nice = true, tickCount = 10 } = options
  const scale = ctor(options)
  if (nice) scale.nice(tickCount)
  return scale
}

function registerBuiltIn(type, factory) {
  registry.set(type, factory)
}
