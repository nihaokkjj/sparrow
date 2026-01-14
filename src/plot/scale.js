import { firstOf, group, lastOf, map, defined } from '../utils'
import { interpolateColor, interpolateNumber } from '../scale'
import { categoricalColors, ordinalColors } from './theme'

export function inferScales(channels, options) {
  const scaleChannels = group(channels.flatMap(Object.entries), ([name]) =>
    scaleName(name)
  )
  const scales = {}
  for (const [name, channels] of scaleChannels) {
    const channel = mergeChannels(name, channels)
    const o = options[name] || {}
    const type = inferScaleType(channel, o) // 推断种类
    scales[name] = {
      ...o,
      ...inferScaleOptions(type, channel, o),
      domain: inferScaleDomain(type, channel, o), // 推断定义域
      range: inferScaleRange(type, channel, o), // 推断值域
      label: inferScaleLabel(type, channel, o),
      type
    }
  }
  return scales
}

function inferScaleType(channel, options) {
  const { name, scale, values } = channel // 当前通道信息
  const { type, domain, range } = options // options.scales 里面的配置

  // 如果通道本身有默认的 scale 种类就是返回当前的种类
  // 比如 interval 的 x 的 scale 就是 band
  if (scale) return scale

  // 如果用户在配置中声明了 type 就返回当前 type
  // 比如 scales: { type: log }
  if (type) return type

  // 如果配置中的 range 或者 domain 的长度大于了 2 就说明是离散比例尺
  // 比如 scales: {fill: {range: ['red', 'yellow', 'green']}}
  if ((domain || range || []).length > 2) return asOrdinalType(name)

  // 根据配置中 domain 的数据类型决定 scale 的种类
  if (domain !== undefined) {
    if (isOrdinal(domain)) return asOrdinalType(name)
    if (isTemporal(domain)) return 'time'
    return 'linear'
  }

  // 根据 channel 对应的 values 决定 scale 的种类
  if (isOrdinal(values)) return asOrdinalType(name)
  if (isTemporal(values)) return 'time'
  if (isUnique(values)) return 'identity'
  return 'linear'
}

function asOrdinalType(name) {
  if (isPosition(name)) return 'dot' // 就是 point 比例尺
  return 'ordinal'
}

function isPosition(name) {
  return name === 'x' || name === 'y'
}

function isOrdinal(values) {
  return values.some((v) => {
    const type = typeof v
    return type === 'string' || type === 'value'
  })
}

function isTemporal(values) {
  return values.some((v) => v instanceof Date)
}

function isUnique(values) {
  return Array.from(new Set(values)).length === 1
}
