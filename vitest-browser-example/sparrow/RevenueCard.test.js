import { beforeEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { renderRevenueCard } from './RevenueCard.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

test('renders a Sparrow SVG scene with real browser layout', async () => {
  await page.viewport(480, 320)

  const { svg } = renderRevenueCard()

  await expect.element(
    page.getByRole('heading', { name: 'Quarterly revenue' })
  ).toBeVisible()
  await expect.element(
    page.getByText('Rendered by Sparrow in a real browser')
  ).toBeVisible()
  await expect.element(
    page.getByRole('img', { name: 'Quarterly revenue chart' })
  ).toBeVisible()
  await expect.element(page.getByTestId('bar-q1')).toBeVisible()
  await expect.element(page.getByTestId('bar-q2')).toBeVisible()

  expect(svg.getAttribute('viewBox')).toBe('0 0 320 180')
  expect(svg.querySelectorAll('rect')).toHaveLength(2)
  expect(svg.querySelector('[data-testid="bar-q1"]').getAttribute('fill')).toBe(
    '#1677ff'
  )
  expect(svg.querySelector('[data-testid="bar-q2"]').getAttribute('height')).toBe(
    '100'
  )

  const box = svg.getBoundingClientRect()
  expect(box.width).toBeCloseTo(Number(svg.getAttribute('width')), 0)
  expect(box.height).toBeCloseTo(Number(svg.getAttribute('height')), 0)
})
