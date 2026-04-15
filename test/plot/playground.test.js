import { expect, test, vi } from 'vitest'
import {
  createMockPlotProvider,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  parsePlotSpecResponse,
  streamPlotSpec
} from '../../src/plot/playground.js'

test('parsePlotSpecResponse() extracts JSON from fenced model output', () => {
  const spec = parsePlotSpecResponse(`
    Sure, use this:

    \`\`\`json
    {
      "plot": {
        "type": "interval",
        "data": [{"x": "A", "y": 1}],
        "encodings": {"x": "x", "y": "y"}
      }
    }
    \`\`\`
  `)

  expect(spec.plot.type).toBe('interval')
  expect(spec.plot.data).toHaveLength(1)
})

test('createPlotSpecChunkBuffer() emits a spec once JSON becomes valid', () => {
  const buffer = createPlotSpecChunkBuffer()

  expect(buffer.push('```json\n{"plot":{"type":"point",')).toBeNull()

  const spec = buffer.push(
    '"data":[{"x":1,"y":2}],"encodings":{"x":"x","y":"y"}}}\n```'
  )
  expect(spec.plot.type).toBe('point')
  expect(buffer.finish().plot.encodings.x).toBe('x')
})

test('streamPlotSpec() runs prompt -> provider -> chunk buffer -> spec -> render', async () => {
  const provider = createMockPlotProvider({ delay: 0, chunkSize: 18 })
  const render = vi.fn((spec) => ({ node: null, spec }))
  const onChunk = vi.fn()
  const onSpec = vi.fn()
  const onRender = vi.fn()

  const result = await streamPlotSpec({
    prompt: '生成一个柱状图',
    provider,
    render,
    onChunk,
    onSpec,
    onRender
  })

  expect(onChunk).toHaveBeenCalled()
  expect(onSpec).toHaveBeenCalled()
  expect(render).toHaveBeenCalledTimes(1)
  expect(onRender).toHaveBeenCalledTimes(1)
  expect(result.spec.plot.type).toBe('interval')
})

test('createOpenAICompatibleProvider() parses SSE content deltas', async () => {
  const payload = [
    'data: {"choices":[{"delta":{"content":"{\\"plot\\":"}}]}\n',
    'data: {"choices":[{"delta":{"content":"{\\"type\\":\\"line\\",\\"data\\":[{\\"x\\":1,\\"y\\":2}],\\"encodings\\":{\\"x\\":\\"x\\",\\"y\\":\\"y\\"}}}"}}]}\n',
    'data: [DONE]\n'
  ].join('')

  const fetchMock = vi.fn(async () => {
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(payload))
          controller.close()
        }
      }),
      { status: 200 }
    )
  })

  const provider = createOpenAICompatibleProvider({
    baseURL: 'https://example.com/v1',
    apiKey: 'token',
    model: 'demo-model',
    fetch: fetchMock
  })

  let text = ''
  for await (const chunk of await provider.stream('show me a line chart')) {
    text += chunk
  }

  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(text).toContain('"type":"line"')
})
