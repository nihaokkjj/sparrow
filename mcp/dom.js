import { JSDOM } from 'jsdom'

function createAnimationFrame(window) {
  return (callback) =>
    window.setTimeout(() => callback(window.performance.now()), 16)
}

export async function withNodeDom(run) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true
  })

  const { window } = dom
  const requestAnimationFrame = createAnimationFrame(window)
  const cancelAnimationFrame = (handle) => window.clearTimeout(handle)
  const patches = [
    ['window', window],
    ['document', window.document],
    ['navigator', window.navigator],
    ['Node', window.Node],
    ['Element', window.Element],
    ['HTMLElement', window.HTMLElement],
    ['SVGElement', window.SVGElement],
    ['performance', window.performance],
    ['getComputedStyle', window.getComputedStyle.bind(window)],
    ['requestAnimationFrame', requestAnimationFrame],
    ['cancelAnimationFrame', cancelAnimationFrame]
  ]
  const previousDescriptors = new Map(
    patches.map(([key]) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  )

  patches.forEach(([key, value]) => {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value
    })
  })

  try {
    return await run(window)
  } finally {
    for (const [key, descriptor] of previousDescriptors.entries()) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
      } else {
        delete globalThis[key]
      }
    }

    window.close()
  }
}
