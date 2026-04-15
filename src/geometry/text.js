import { createChannel, createChannels } from './channel.js'
import { channelStyles } from './style.js'

export function text(renderer, I, scales, channels, directStyles, coordinate) {
  const { x: X, y: Y, text: T } = channels

  return Array.from(I, (i) => {
    const [x, y] = coordinate([X[i], Y[i]])

    return renderer.text({
      ...directStyles,
      ...channelStyles(i, channels),
      x,
      y,
      text: T[i]
    })
  })
}

text.channels = () =>
  createChannels({
    text: createChannel({ name: 'text', optional: false })
  })
