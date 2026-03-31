import { normalize, tickStep, nice, floor, ceil, ticks } from './utils.js'
export function createLinear({
  domain: [d0, d1],
  range: [r0, r1],
  interpolate = interpolateNumber
}) {
  const scale = (x) => {
    const t = normalize(x, d0, d1)
    return interpolate(t, r0, r1)
  }

  scale.ticks = (tickCount) => ticks(d0, d1, tickCount)
  scale.nice = (tickCount) => {
    const step = tickStep(d0, d1, tickCount)
    ;[d0, d1] = nice([d0, d1], {
      floor: (x) => floor(x, step),
      ceil: (x) => ceil(x, step)
    })
  }

  return scale
}

export function interpolateNumber(t, start, stop) {
  return start * (1 - t) + stop * t
}

export function interpolateColor(t, start, stop) {
  const [r0, g0, b0, a0] = parseColor(start)
  const [r1, g1, b1, a1] = parseColor(stop)
  const mix = (a, b) => Math.round(interpolateNumber(t, a, b))
  const alpha = interpolateNumber(t, a0, a1)
  const color = [mix(r0, r1), mix(g0, g1), mix(b0, b1)]

  if (alpha < 1) {
    return toRgbaColor(...color, alpha)
  }

  return toHexColor(...color)
}

function parseColor(color) {
  const hex = color.startsWith('#') ? color.slice(1) : color
  if (/^[0-9a-f]{3,4}$/i.test(hex)) return parseShortHexColor(hex)
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return parseLongHexColor(hex)

  const match = color.match(/^rgba?\((.+)\)$/i)
  if (match) return parseRgbColor(match[1])

  throw new Error(`Unsupported color format: ${color}`)
}

function toHexColor(r, g, b) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}

function toRgbaColor(r, g, b, a) {
  return `rgba(${r}, ${g}, ${b}, ${roundAlpha(a)})`
}

function parseShortHexColor(hex) {
  const channels = hex.split('').map((d) => Number.parseInt(`${d}${d}`, 16))
  if (channels.length === 3) return [...channels, 1]
  const [r, g, b, a] = channels
  return [r, g, b, a / 255]
}

function parseLongHexColor(hex) {
  const channels = new Array(hex.length / 2)
    .fill(0)
    .map((_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
  if (channels.length === 3) return [...channels, 1]
  const [r, g, b, a] = channels
  return [r, g, b, a / 255]
}

function parseRgbColor(body) {
  const channels = body.split(',').map((part) => part.trim())
  if (channels.length < 3 || channels.length > 4) {
    throw new Error(`Unsupported color format: rgba(${body})`)
  }

  const [r, g, b] = channels.slice(0, 3).map(parseRgbChannel)
  const a = channels[3] === undefined ? 1 : parseAlphaChannel(channels[3])
  return [r, g, b, a]
}

function parseRgbChannel(value) {
  if (value.endsWith('%')) {
    return Math.round((Number.parseFloat(value) / 100) * 255)
  }
  return Math.round(Number.parseFloat(value))
}

function parseAlphaChannel(value) {
  if (value.endsWith('%')) {
    return Number.parseFloat(value) / 100
  }
  return Number.parseFloat(value)
}

function roundAlpha(value) {
  return Math.round(value * 1000) / 1000
}
