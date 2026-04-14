import { createRenderer } from '../../src/index.js'

export function renderRevenueCard({ mountTo = document.body } = {}) {
  const section = document.createElement('section')
  section.setAttribute('data-testid', 'revenue-card')

  const title = document.createElement('h2')
  title.textContent = 'Quarterly revenue'

  const note = document.createElement('p')
  note.textContent = 'Rendered by Sparrow in a real browser'

  const renderer = createRenderer(320, 180)
  const svg = renderer.node()
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', 'Quarterly revenue chart')
  svg.setAttribute('data-testid', 'sparrow-chart')

  renderer.line({
    x1: 24,
    y1: 150,
    x2: 296,
    y2: 150,
    stroke: '#d9d9d9',
    strokeWidth: 2
  })

  renderer.rect({
    x: 40,
    y: 74,
    width: 48,
    height: 76,
    fill: '#1677ff',
    rx: 6,
    dataTestid: 'bar-q1'
  })

  renderer.rect({
    x: 120,
    y: 50,
    width: 48,
    height: 100,
    fill: '#52c41a',
    rx: 6,
    dataTestid: 'bar-q2'
  })

  renderer.text({
    x: 64,
    y: 64,
    text: '76',
    textAnchor: 'middle',
    fill: '#1677ff',
    fontSize: 12
  })

  renderer.text({
    x: 144,
    y: 40,
    text: '100',
    textAnchor: 'middle',
    fill: '#52c41a',
    fontSize: 12
  })

  renderer.text({
    x: 64,
    y: 168,
    text: 'Q1',
    textAnchor: 'middle',
    fill: '#595959',
    fontSize: 12
  })

  renderer.text({
    x: 144,
    y: 168,
    text: 'Q2',
    textAnchor: 'middle',
    fill: '#595959',
    fontSize: 12
  })

  section.appendChild(title)
  section.appendChild(note)
  section.appendChild(svg)
  mountTo.appendChild(section)

  return { section, svg }
}
