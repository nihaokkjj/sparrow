import { renderPlotSpec } from './renderPlotSpec.js'

export const DEFAULT_PLOT_SPEC_SYSTEM_PROMPT = [
  'You generate JSON only for Sparrow plot specs.',
  'Return a single JSON object with keys such as width, height, padding, coordinate, plot, scales, and guides.',
  'Only use plot.type values point, line, or interval.',
  'plot.data must be an array of plain JSON objects.',
  'plot.encodings must map channel names like x, y, fill, stroke, r to field names or constants.',
  'Do not return Markdown unless the JSON is inside a single fenced json block.',
  'Do not include explanations before or after the JSON.'
].join(' ')

export function createPlotSpecMessages(
  prompt,
  { systemPrompt = DEFAULT_PLOT_SPEC_SYSTEM_PROMPT } = {}
) {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ]
}

export function parsePlotSpecResponse(text) {
  const source = String(text || '')
  const candidates = [
    ...extractFencedBlocks(source),
    ...extractJSONObjectCandidates(source),
    source.trim()
  ]

  const seen = new Set()
  for (const candidate of candidates) {
    const normalized = candidate.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    try {
      const value = JSON.parse(normalized)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value
      }
    } catch {
      // ignore parse failures while the stream is incomplete
    }
  }

  return null
}

export function createPlotSpecChunkBuffer({
  parse = parsePlotSpecResponse
} = {}) {
  let raw = ''
  let spec = null
  let fingerprint = ''

  return {
    push(chunk) {
      raw += normalizeChunk(chunk)
      const next = parse(raw)
      if (!next) return null

      const nextFingerprint = JSON.stringify(next)
      if (nextFingerprint === fingerprint) return null

      spec = next
      fingerprint = nextFingerprint
      return next
    },
    reset() {
      raw = ''
      spec = null
      fingerprint = ''
    },
    finish() {
      const next = parse(raw)
      if (next) {
        spec = next
        fingerprint = JSON.stringify(next)
      }
      return spec
    },
    getSpec() {
      return spec
    },
    getText() {
      return raw
    }
  }
}

export async function streamPlotSpec({
  prompt,
  provider,
  render = renderPlotSpec,
  renderOptions,
  buffer = createPlotSpecChunkBuffer(),
  signal,
  onStart,
  onChunk,
  onSpec,
  onRender,
  onComplete,
  onError
}) {
  try {
    if (!prompt || !String(prompt).trim()) {
      throw new Error('streamPlotSpec requires a non-empty prompt.')
    }

    onStart?.({ prompt })

    const source = await requestProviderStream(provider, prompt, { signal })
    let result = null

    for await (const chunk of readTextChunks(source)) {
      if (!chunk) continue

      const spec = buffer.push(chunk)
      const text = buffer.getText()
      onChunk?.(chunk, text)

      if (spec) {
        onSpec?.(spec, text)
        result = render(spec, renderOptions)
        onRender?.(result, spec, text)
      }
    }

    const spec = buffer.finish()
    if (!spec) {
      throw new Error(
        'Provider output did not contain a valid Sparrow plot spec JSON object.'
      )
    }

    if (!result) {
      onSpec?.(spec, buffer.getText())
      result = render(spec, renderOptions)
      onRender?.(result, spec, buffer.getText())
    }

    const payload = {
      prompt,
      spec,
      result,
      text: buffer.getText()
    }

    onComplete?.(payload)
    return payload
  } catch (error) {
    onError?.(error)
    throw error
  }
}

export function createOpenAICompatibleProvider({
  baseURL,
  apiKey,
  model,
  headers = {},
  fetch: fetchImpl = globalThis.fetch,
  systemPrompt = DEFAULT_PLOT_SPEC_SYSTEM_PROMPT,
  requestBody = {}
}) {
  return {
    async stream(prompt, options = {}) {
      if (!fetchImpl) {
        throw new Error('Fetch is not available in the current runtime.')
      }

      if (!baseURL) {
        throw new Error('createOpenAICompatibleProvider requires baseURL.')
      }

      if (!model) {
        throw new Error('createOpenAICompatibleProvider requires model.')
      }

      const response = await fetchImpl(
        `${baseURL.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
            ...headers
          },
          body: JSON.stringify({
            model,
            stream: true,
            messages:
              options.messages ||
              createPlotSpecMessages(prompt, {
                systemPrompt: options.systemPrompt || systemPrompt
              }),
            ...requestBody,
            ...(options.requestBody || {})
          }),
          signal: options.signal
        }
      )

      if (!response.ok) {
        throw new Error(
          `Provider request failed with status ${response.status}.`
        )
      }

      if (!response.body) {
        throw new Error('Provider response did not include a readable body.')
      }

      return readOpenAICompatibleStream(response.body)
    }
  }
}

export function createMockPlotProvider({
  delay = 60,
  chunkSize = 28,
  formatter = formatMockResponse
} = {}) {
  return {
    async *stream(prompt) {
      const text = formatter(createMockSpec(prompt), prompt)
      const chunks = splitText(text, chunkSize)
      for (const chunk of chunks) {
        if (delay > 0) {
          await wait(delay)
        }
        yield chunk
      }
    }
  }
}

async function requestProviderStream(provider, prompt, options) {
  if (!provider) {
    throw new Error('streamPlotSpec requires a provider.')
  }

  if (typeof provider === 'function') {
    return provider(prompt, options)
  }

  if (typeof provider.stream === 'function') {
    return provider.stream(prompt, options)
  }

  throw new Error(
    'Provider must be a function or an object with a stream() method.'
  )
}

async function* readTextChunks(source) {
  if (!source) return

  if (typeof source === 'string') {
    yield source
    return
  }

  if (typeof source[Symbol.asyncIterator] === 'function') {
    for await (const chunk of source) {
      yield normalizeChunk(chunk)
    }
    return
  }

  if (typeof source.getReader === 'function') {
    const reader = source.getReader()
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        yield normalizeChunk(value, decoder)
      }
    } finally {
      reader.releaseLock?.()
    }
    return
  }

  if (typeof source[Symbol.iterator] === 'function') {
    for (const chunk of source) {
      yield normalizeChunk(chunk)
    }
    return
  }

  throw new Error('Unsupported provider stream source.')
}

async function* readOpenAICompatibleStream(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue

        const parsed = JSON.parse(data)
        const content = extractOpenAICompatibleDelta(parsed)
        if (content) yield content
      }
    }

    const tail = buffer.trim()
    if (tail.startsWith('data:')) {
      const data = tail.slice(5).trim()
      if (data && data !== '[DONE]') {
        const parsed = JSON.parse(data)
        const content = extractOpenAICompatibleDelta(parsed)
        if (content) yield content
      }
    }
  } finally {
    reader.releaseLock?.()
  }
}

function extractOpenAICompatibleDelta(payload) {
  const choice = payload?.choices?.[0]
  const delta = choice?.delta || choice?.message || {}
  const content = delta.content

  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || '')
      .join('')
  }

  return ''
}

function extractFencedBlocks(text) {
  const matches = text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)
  return Array.from(matches, (match) => match[1] || '')
}

function extractJSONObjectCandidates(text) {
  const candidates = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, index + 1))
        start = -1
      }
    }
  }

  return candidates
}

function normalizeChunk(chunk, decoder = new TextDecoder()) {
  if (typeof chunk === 'string') return chunk
  if (chunk instanceof Uint8Array) return decoder.decode(chunk, { stream: true })
  if (ArrayBuffer.isView(chunk)) return decoder.decode(chunk, { stream: true })
  if (chunk instanceof ArrayBuffer) {
    return decoder.decode(new Uint8Array(chunk), { stream: true })
  }
  return String(chunk || '')
}

function createMockSpec(prompt) {
  const normalized = String(prompt || '').toLowerCase()

  if (containsAny(normalized, ['line', 'trend', '走势', '趋势'])) {
    return {
      width: 640,
      height: 360,
      padding: { top: 24, right: 32, bottom: 48, left: 56 },
      plot: {
        type: 'line',
        data: [
          { step: 'Q1', value: 18 },
          { step: 'Q2', value: 27 },
          { step: 'Q3', value: 34 },
          { step: 'Q4', value: 30 }
        ],
        encodings: {
          x: 'step',
          y: 'value'
        },
        styles: {
          stroke: '#7c3aed',
          strokeWidth: 3
        }
      },
      scales: {
        x: { type: 'dot' },
        y: { zero: true }
      },
      guides: {
        x: { label: 'Quarter' },
        y: { label: 'Value', grid: true }
      }
    }
  }

  if (containsAny(normalized, ['point', 'scatter', '分布', '散点'])) {
    return {
      width: 640,
      height: 360,
      padding: { top: 24, right: 32, bottom: 48, left: 56 },
      plot: {
        type: 'point',
        data: [
          { x: 12, y: 18, fill: '#2563eb', r: 5 },
          { x: 18, y: 26, fill: '#7c3aed', r: 6 },
          { x: 24, y: 20, fill: '#16a34a', r: 5 },
          { x: 32, y: 34, fill: '#ea580c', r: 7 }
        ],
        encodings: {
          x: 'x',
          y: 'y',
          fill: 'fill',
          r: 'r'
        },
        styles: {
          stroke: '#0f172a',
          strokeWidth: 1
        }
      },
      guides: {
        x: { label: 'X', grid: true },
        y: { label: 'Y', grid: true }
      }
    }
  }

  return {
    width: 640,
    height: 360,
    padding: { top: 24, right: 32, bottom: 48, left: 56 },
    plot: {
      type: 'interval',
      data: [
        { category: 'Acquire', value: 18 },
        { category: 'Activate', value: 26 },
        { category: 'Retain', value: 21 },
        { category: 'Revenue', value: 30 }
      ],
      encodings: {
        x: 'category',
        y: 'value'
      },
      styles: {
        fill: '#2563eb',
        stroke: '#0f172a',
        strokeWidth: 1
      }
    },
    scales: {
      y: { zero: true }
    },
    guides: {
      x: { label: 'Stage' },
      y: { label: 'Value', grid: true }
    }
  }
}

function formatMockResponse(spec) {
  return `Here is the Sparrow plot spec:\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\``
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

function splitText(text, size) {
  const chunks = []
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size))
  }
  return chunks
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
