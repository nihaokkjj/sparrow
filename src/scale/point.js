import { createBand } from './band.js'

export function createPoint(options) {
  return createBand({ ...options, padding: 1 })
}
