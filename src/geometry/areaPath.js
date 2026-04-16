export function areaPath(topPoints, bottomPoints) {
  const top = topPoints.map(([x, y], index) => [index === 0 ? 'M' : 'L', x, y])
  const bottom = bottomPoints
    .slice()
    .reverse()
    .map(([x, y]) => ['L', x, y])

  return [...top, ...bottom, ['Z']]
}
