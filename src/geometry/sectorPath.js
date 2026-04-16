export function sectorPath(coordinate, { x, x1, y, y1 }) {
  const steps = Math.max(4, Math.ceil(Math.abs(x1 - x) * 64))
  const outer = sampleArc(coordinate, x, x1, y, steps, true)
  const inner = sampleArc(coordinate, x1, x, y1, steps, false)
  return [...outer, ...inner, ['Z']]
}

export function formatPathData(path) {
  return path.flat().join(' ')
}

function sampleArc(coordinate, start, end, radius, steps, moveToFirst) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const angle = start * (1 - t) + end * t
    const [x, y] = coordinate([angle, radius])
    return [moveToFirst && index === 0 ? 'M' : 'L', x, y]
  })
}
