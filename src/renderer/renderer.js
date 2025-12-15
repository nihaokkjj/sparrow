import { createContext } from './context.js'
import { line, circle, text, rect, path } from './shape.js'
export function createRenderer(
  width,
  height,
  {
    line: drawLine = line,
    circle: drawCircle = circle,
    text: drawText = text,
    rect: drawRect = rect,
    path: drawPath = path,
    context: intensifyContext = (d) => d
  } = {}
) {
  const context = intensifyContext(createContext(width, height))

  return {
    line: (attributes) => drawLine(context, attributes),
    circle: (attributes) => drawCircle(context, attributes),
    text: (attributes) => drawText(context, attributes),
    rect: (attributes) => drawRect(context, attributes),
    path: (attributes) => drawPath(context, attributes),
    node: () => context.node,
    group: () => context.group
  }
}
