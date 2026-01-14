import { expect, test } from 'vitest'
import { channelStyles } from '../../src/geometry/style.js'

test('channelStyles() picks stroke and fill based on provided channels', () => {
  const styles = channelStyles(1, {
    stroke: ['#111', '#222'],
    fill: ['#aaa', '#bbb']
  })
  expect(styles).toEqual({ stroke: '#222', fill: '#bbb' })
})

test('channelStyles() ignores undefined channels gracefully', () => {
  const styles = channelStyles(0, {})
  expect(styles).toEqual({})
})
