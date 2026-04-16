import { identity } from '../utils'

export function legendSwatches(
  renderer,
  scale,
  coordinate,
  {
    x,
    y,
    width = 48,
    marginLeft = 12,
    swatchSize = 10,
    fontSize = 10,
    formatter = identity,
    domain,
    label,
    orientation = 'horizontal'
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

  const legendY = label ? swatchSize * 2 : 0

  if (orientation === 'vertical') {
    // 纵向布局：垂直排列
    for (const [index, domainValue] of Object.entries(domain)) {
      const color = scale(domainValue)
      const itemY = index * (swatchSize + 20)

      renderer.rect({
        x: 0,
        y: legendY + itemY,
        width: swatchSize,
        height: swatchSize,
        stroke: color,
        fill: color
      })

      renderer.text({
        text: formatter(domainValue),
        x: swatchSize + 6,
        y: legendY + itemY + swatchSize,
        fill: 'currentColor',
        fontSize,
        textAnchor: 'start'
      })
    }
  } else {
    // 横向布局：水平排列
    for (const [index, domainValue] of Object.entries(domain)) {
      const color = scale(domainValue)
      const legendX = width * index

      renderer.rect({
        x: legendX,
        y: legendY,
        width: swatchSize,
        height: swatchSize,
        stroke: color,
        fill: color
      })

      const textX = legendX + marginLeft + swatchSize
      const textY = legendY + swatchSize
      renderer.text({
        text: formatter(domainValue),
        x: textX,
        y: textY,
        fill: 'currentColor',
        fontSize
      })
    }
  }

  renderer.restore()
}
