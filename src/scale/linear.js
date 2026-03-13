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
  const [r0, g0, b0] = parseHexColor(start)
  const [r1, g1, b1] = parseHexColor(stop)
  const mix = (a, b) => Math.round(interpolateNumber(t, a, b))
  return toHexColor(mix(r0, r1), mix(g0, g1), mix(b0, b1))
}

function parseHexColor(color) {
  const hex = color.startsWith('#') ? color.slice(1) : color
  if (hex.length === 3) {
    return hex.split('').map((d) => Number.parseInt(`${d}${d}`, 16))
  }
  if (hex.length === 6) {
    return [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((d) =>
      Number.parseInt(d, 16)
    )
  }
  throw new Error(`Unsupported color format: ${color}`)
}

function toHexColor(r, g, b) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}
