import { identity } from '../utils'

export function createAxis(components, labelOf) {
  const pickLabelTick = labelOf || ((ticks) => ticks[ticks.length - 1])

  return (
    renderer,
    scale,
    coordinate,
    {
      domain,
      label,
      position,
      tickCount = 5,
      formatter = identity,
      tickLength = 5,
      fontSize = 12,
      grid = false,
      tick = true
    }
  ) => {
    const offset = scale.bandWidth ? scale.bandWidth() / 2 : 0
    const values = scale.ticks ? scale.ticks(tickCount) : domain
    const center = coordinate.center()
    const type = `${+coordinate.isPolar()}${+coordinate.isTranspose()}`
    const options = { tickLength, fontSize, center }
    const component = pickComponent(components, type, position)
    const {
      grid: Grid,
      ticks: Ticks,
      label: Label,
      start,
      end
    } = component

    const ticksData = values.map((d) => {
      const [x, y] = coordinate(start(d, scale, offset))
      const text = formatter(d)
      return { x, y, text }
    })

    if (grid && Grid) Grid(renderer, ticksData, end(coordinate))
    if (tick && Ticks) Ticks(renderer, ticksData, options)
    if (label && Label) Label(renderer, label, pickLabelTick(ticksData), options)
  }
}

function pickComponent(components, type, position) {
  const component = components[type]
  if (!component) {
    throw new Error(`Unsupported axis component type: ${type}`)
  }

  if (!component.positions) return component

  const nextPosition = normalizePosition(position, component.defaultPosition)
  return component.positions[nextPosition] || component.positions[component.defaultPosition]
}

function normalizePosition(position, fallback) {
  switch (position) {
    case 'top':
    case 'bottom':
    case 'left':
    case 'right':
      return position
    default:
      return fallback
  }
}
