import { curry } from '../utils/helper.js'
import { scale, translate } from './transforms.js'

function coordinate(transformOptions, canvasOptions) {
  const { x, y, width, height } = canvasOptions
  return [scale(width, height), translate(x, y)]
}

export const cartesian = curry(coordinate)
