import { expect, test, vi } from 'vitest'
import {
  DEFAULT_PLOT_SPEC_SYSTEM_PROMPT,
  createPlotSpecMessages,
  createMockPlotProvider,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  parsePlotSpecResponse,
  streamPlotSpec
} from '../../src/plot/playground.js'
import {
  OPENAI_PROXY_TARGET_HEADER,
  buildOpenAICompatibleRequestURL,
  buildProviderRequestConfig,
  buildProxyTargetURL
} from '../../src/plot/providerConfig.js'

test('createPlotSpecMessages() instructs the model to output SparrowPlotSpec JSON', () => {
  const messages = createPlotSpecMessages('make a line chart')

  expect(messages).toEqual([
    {
      role: 'system',
      content: DEFAULT_PLOT_SPEC_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: 'make a line chart'
    }
  ])
  expect(messages[0].content).toContain('`SparrowPlotSpec` JSON object')
  expect(messages[0].content).toContain('Only use these mark types')
  expect(messages[0].content).toContain('Use `plots` when multiple marks')
  expect(messages[0].content).toContain('Only use these `view.type` values')
  expect(messages[0].content).toContain('facet')
  expect(messages[0].content).toContain('animation.enter')
  expect(messages[0].content).toContain('grow-y')
  expect(messages[0].content).toContain('sweep-in')
  expect(messages[0].content).toContain('draw-in')
})

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

test('streamPlotSpec() renders view specs with the default AI renderer', async () => {
  const provider = {
    async *stream() {
      yield JSON.stringify({
        width: 720,
        height: 320,
        view: {
          type: 'row',
          padding: 20,
          children: [
            {
              plot: {
                type: 'interval',
                data: [
                  { category: 'A', value: 3 },
                  { category: 'B', value: 5 }
                ],
                encodings: { x: 'category', y: 'value' }
              },
              scales: {
                y: { zero: true }
              },
              guides: false
            },
            {
              plot: {
                type: 'line',
                data: [
                  { step: 'Q1', value: 2 },
                  { step: 'Q2', value: 6 }
                ],
                encodings: { x: 'step', y: 'value' }
              },
              scales: {
                x: { type: 'dot' },
                y: { zero: true }
              },
              guides: false
            }
          ]
        }
      })
    }
  }

  const result = await streamPlotSpec({
    prompt: 'make a small dashboard',
    provider
  })

  expect(result.result.views).toHaveLength(2)
  expect(result.result.marks).toHaveLength(3)
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

test('buildOpenAICompatibleRequestURL() joins base URL and chat path safely', () => {
  expect(buildOpenAICompatibleRequestURL('https://example.com/v1')).toBe(
    'https://example.com/v1/chat/completions'
  )
  expect(buildOpenAICompatibleRequestURL('/api/openai')).toBe(
    '/api/openai/chat/completions'
  )
})

test('buildProviderRequestConfig() adds a proxy target header only in proxy mode', () => {
  expect(
    buildProviderRequestConfig({
      connectionMode: 'proxy',
      targetBaseURL: 'https://relay.example.com/v1'
    })
  ).toEqual({
    connectionMode: 'proxy',
    baseURL: '/api/openai',
    headers: {
      [OPENAI_PROXY_TARGET_HEADER]: 'https://relay.example.com/v1'
    }
  })

  expect(
    buildProviderRequestConfig({
      connectionMode: 'direct',
      targetBaseURL: 'https://api.openai.com/v1'
    })
  ).toEqual({
    connectionMode: 'direct',
    baseURL: 'https://api.openai.com/v1',
    headers: {}
  })
})

test('buildProxyTargetURL() resolves a same-origin proxy request to the chosen target', () => {
  expect(
    buildProxyTargetURL({
      proxyPath: '/api/openai',
      requestURL: '/api/openai/chat/completions?stream=true',
      targetBaseURL: 'https://relay.example.com/v1'
    })
  ).toBe('https://relay.example.com/v1/chat/completions?stream=true')
})

test('createOpenAICompatibleProvider() forwards custom proxy headers to fetch', async () => {
  const fetchMock = vi.fn(async () => {
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: [DONE]\n'))
          controller.close()
        }
      }),
      { status: 200 }
    )
  })

  const requestConfig = buildProviderRequestConfig({
    connectionMode: 'proxy',
    targetBaseURL: 'https://relay.example.com/v1'
  })

  const provider = createOpenAICompatibleProvider({
    baseURL: requestConfig.baseURL,
    headers: requestConfig.headers,
    model: 'demo-model',
    fetch: fetchMock
  })

  await provider.stream('show me a line chart')

  expect(fetchMock).toHaveBeenCalledWith('/api/openai/chat/completions', {
    method: 'POST',
    headers: expect.objectContaining({
      'Content-Type': 'application/json',
      [OPENAI_PROXY_TARGET_HEADER]: 'https://relay.example.com/v1'
    }),
    body: expect.any(String),
    signal: undefined
  })
})
