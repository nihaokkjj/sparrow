import { createOrdinal } from './ordinal.js'
import { band } from './utils.js'

export function createBand(options) {
  const { bandRange, bandWidth, step } = band(options)
  const scale = createOrdinal({ ...options, range: bandRange })

  scale.bandWidth = () => bandWidth
  scale.step = () => step

  return scale
}
