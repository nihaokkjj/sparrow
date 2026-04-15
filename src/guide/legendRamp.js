import { createLinear } from '../scale'
import { identity } from '../utils'
import { ticksBottom } from './ticks'

export function legendRamp(
  renderer,
  scale,
  coordinate,
  {
    x,
    y,
    width = 120,
    height = 10,
    domain,
    tickCount = 5,
    tickLength = height + 5,
    formatter = identity,
    fontSize = 10,
    label
  }
) {
  renderer.save()
  renderer.translate(x, y)

  if (label) {
    renderer.text({
      text: label,
      x: 0,
      y: 0,
      fontWeight: 'bold',
      fontSize,
      textAnchor: 'start',
      dy: '1em'
    })
  }

  const value = createLinear({ domain: [0, width], range: domain })
  const legendY = label ? height * 2 : 0

  for (let index = 0; index < width; index += 1) {
    const stroke = scale(value(index))
    renderer.line({
      x1: index,
      y1: legendY,
      x2: index,
      y2: legendY + height,
      stroke
    })
  }

  const position = createLinear({ domain, range: [0, width] })
  const values = position.ticks(tickCount)
  const ticks = values.map((d) => ({
    x: position(d),
    y: legendY,
    text: formatter(d)
  }))
  ticksBottom(renderer, ticks, { fontSize, tickLength })

  renderer.restore()
}
