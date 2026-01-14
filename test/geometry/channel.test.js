import { describe, expect, test } from 'vitest'
import {
  createChannel,
  createChannels
} from '../../src/geometry/channel.js'

describe('createChannel()', () => {
  test('defaults optional to true', () => {
    const channel = createChannel({ name: 'size' })
    expect(channel).toMatchObject({ name: 'size', optional: true })
  })

  test('respects custom options', () => {
    const channel = createChannel({
      name: 'x',
      optional: false,
      scale: 'band'
    })
    expect(channel.optional).toBe(false)
    expect(channel.scale).toBe('band')
  })
})

describe('createChannels()', () => {
  test('returns required x/y channels and merges extra ones', () => {
    const channels = createChannels({
      size: createChannel({ name: 'size' })
    })
    expect(channels.x.optional).toBe(false)
    expect(channels.y.optional).toBe(false)
    expect(channels.stroke.optional).toBe(true)
    expect(channels.fill.optional).toBe(true)
    expect(channels.size.name).toBe('size')
  })
})
