import { renderAISpec } from './renderAISpec.js'

import { buildOpenAICompatibleRequestURL } from './providerConfig.js'
import { DEFAULT_PLOT_SPEC_SYSTEM_PROMPT } from './prompts.js'
import {
  SparrowSpecValidationError,
  formatValidationReport,
  validateSparrowSpec
} from './validateSpec.js'

export { DEFAULT_PLOT_SPEC_SYSTEM_PROMPT } from './prompts.js'

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

export function createPlotSpecNDJSONBuffer() {
  let raw = ''
  let pending = ''
  let lineNumber = 0

  return {
    push(chunk) {
      const text = normalizeChunk(chunk)
      raw += text
      pending += text

      const lines = pending.split(/\r?\n/)
      pending = lines.pop() || ''

      return lines
        .map((line) =>
          parsePlotSpecStreamEvent(line, { lineNumber: ++lineNumber })
        )
        .filter(Boolean)
    },
    reset() {
      raw = ''
      pending = ''
      lineNumber = 0
    },
    finish() {
      const tail = pending.trim()
      pending = ''
      return tail
        ? [
            parsePlotSpecStreamEvent(tail, {
              lineNumber: ++lineNumber
            })
          ].filter(Boolean)
        : []
    },
    getSpec() {
      return parsePlotSpecResponse(raw)
    },
    getText() {
      return raw
    }
  }
}

export function createPlotSpecChunkBuffer({
  parse = parsePlotSpecResponse
} = {}) {
  let raw = ''
  let spec = null
  let fingerprint = ''
  const parser =
    parse === parsePlotSpecResponse
      ? createIncrementalPlotSpecParser(() => raw)
      : null

  return {
    push(chunk) {
      const text = normalizeChunk(chunk)
      raw += text
      const next = parser ? parser.push(text) : parse(raw)
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
      parser?.reset()
    },
    finish() {
      const next = parser ? parser.finish(raw) : parse(raw)
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

function createIncrementalPlotSpecParser(getRaw) {
  const candidates = []
  let inFence = false
  let fenceStartOfLine = true
  let pendingFenceTicks = 0
  let fenceBody = ''
  let objectStart = -1
  let objectDepth = 0
  let objectInString = false
  let objectEscaped = false
  let offset = 0

  function push(text) {
    scan(text)
    return parseLatestCandidate()
  }

  function finish(raw) {
    flushFenceTicks()
    const latest = parseLatestCandidate()
    if (latest) return latest
    return parsePlotSpecResponse(raw)
  }

  function reset() {
    candidates.length = 0
    inFence = false
    fenceStartOfLine = true
    pendingFenceTicks = 0
    fenceBody = ''
    objectStart = -1
    objectDepth = 0
    objectInString = false
    objectEscaped = false
    offset = 0
  }

  function scan(text) {
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index]
      const absoluteIndex = offset + index

      scanFence(char)
      scanObject(char, absoluteIndex)
    }
    if (pendingFenceTicks >= 3) flushFenceTicks()
    offset += text.length
  }

  function scanFence(char) {
    if (fenceStartOfLine && char === '`') {
      pendingFenceTicks += 1
      return
    }

    flushFenceTicks()

    if (inFence) fenceBody += char
    fenceStartOfLine = char === '\n' || char === '\r'
  }

  function flushFenceTicks() {
    if (pendingFenceTicks >= 3) {
      inFence = !inFence
      if (!inFence) {
        const candidate = stripFenceInfoLine(fenceBody)
        if (candidate.trim()) candidates.push(candidate)
        fenceBody = ''
      }
    } else if (inFence && pendingFenceTicks > 0) {
      fenceBody += '`'.repeat(pendingFenceTicks)
    }

    pendingFenceTicks = 0
  }

  function scanObject(char, absoluteIndex) {
    if (objectInString) {
      if (objectEscaped) {
        objectEscaped = false
      } else if (char === '\\') {
        objectEscaped = true
      } else if (char === '"') {
        objectInString = false
      }
      return
    }

    if (char === '"') {
      objectInString = true
      return
    }

    if (char === '{') {
      if (objectDepth === 0) objectStart = absoluteIndex
      objectDepth += 1
      return
    }

    if (char === '}') {
      if (objectDepth === 0) return
      objectDepth -= 1
      if (objectDepth === 0 && objectStart !== -1) {
        candidates.push(getRaw().slice(objectStart, absoluteIndex + 1))
        objectStart = -1
      }
    }
  }

  function parseLatestCandidate() {
    while (candidates.length > 0) {
      const candidate = candidates[candidates.length - 1].trim()
      candidates.pop()
      if (!candidate) continue

      try {
        const value = JSON.parse(candidate)
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return value
        }
      } catch {
        // ignore parse failures while the stream is incomplete
      }
    }

    return null
  }

  return { push, reset, finish }
}

function stripFenceInfoLine(text) {
  const source = String(text || '')
  const lineBreakIndex = source.search(/\r?\n/)
  if (lineBreakIndex === -1) return source

  const firstLine = source.slice(0, lineBreakIndex).trim()
  if (firstLine && /^[a-z][\w-]*$/i.test(firstLine)) {
    return source.slice(lineBreakIndex).replace(/^\r?\n/, '')
  }

  return source
}

function parsePlotSpecStreamEvent(line, meta = {}) {
  const source = String(line || '').trim()
  if (!source) return null

  try {
    const event = normalizePlotSpecStreamEvent(JSON.parse(source))
    if (event) return event

    return createPlotSpecStreamParseError({
      code: 'invalid_event',
      lineNumber: meta.lineNumber,
      raw: source,
      message:
        'NDJSON line is valid JSON but not a supported plot stream event.'
    })
  } catch (error) {
    return createPlotSpecStreamParseError({
      code: 'invalid_json',
      lineNumber: meta.lineNumber,
      raw: source,
      message: error?.message || 'Invalid JSON line.'
    })
  }
}

function createPlotSpecStreamParseError({ code, lineNumber, raw, message }) {
  return {
    type: 'parse-error',
    code,
    recoverable: true,
    ...(lineNumber !== undefined && { lineNumber }),
    raw,
    message
  }
}

function normalizePlotSpecStreamEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const type = typeof value.type === 'string' ? value.type.toLowerCase() : ''
  if (type === 'layout') {
    return {
      ...value,
      type,
      layout: value.layout || value.view || value.spec?.view || null
    }
  }

  if (type === 'chart' || type === 'plot') {
    const spec = value.spec || (value.plot ? { plot: value.plot } : value.view)
    if (!spec || typeof spec !== 'object') return null

    return {
      ...value,
      type: 'chart',
      id: value.id || value.slot || value.key || null,
      spec
    }
  }

  if (type === 'spec') {
    const spec = value.spec || value.payload || null
    if (!spec || typeof spec !== 'object') return null
    return { ...value, type, spec }
  }

  if (type === 'done' || type === 'error' || type === 'start') {
    return { ...value, type }
  }

  return null
}

function createPlotSpecStreamEventState() {
  let layout = null
  let title = ''
  let done = false
  let latestSpec = null
  const chartOrder = []
  const charts = new Map()

  return {
    apply(event) {
      if (!event) return snapshot()

      if (event.type === 'start') {
        title = event.title || title
      } else if (event.type === 'layout') {
        layout = normalizeStreamLayout(event.layout || event)
        title = event.title || title
      } else if (event.type === 'chart') {
        const id = String(event.id || `chart-${chartOrder.length + 1}`)
        if (!charts.has(id)) chartOrder.push(id)
        charts.set(id, { id, spec: event.spec, event })
        latestSpec = assembleStreamSpec({ layout, chartOrder, charts, title })
      } else if (event.type === 'spec') {
        latestSpec = event.spec
      } else if (event.type === 'done') {
        done = true
        latestSpec =
          latestSpec ||
          assembleStreamSpec({ layout, chartOrder, charts, title })
      }

      return snapshot()
    },
    getSpec() {
      return latestSpec
    },
    hasEvents() {
      return Boolean(
        layout || title || done || chartOrder.length > 0 || latestSpec
      )
    }
  }

  function snapshot() {
    return {
      layout,
      title,
      done,
      spec: latestSpec,
      charts: chartOrder.map((id) => charts.get(id))
    }
  }
}

function normalizeStreamLayout(layout) {
  if (!layout || typeof layout !== 'object') return null
  const view = layout.view || layout
  const rawSlots = Array.isArray(layout.slots)
    ? layout.slots
    : Array.isArray(view.slots)
      ? view.slots
      : Array.isArray(view.children)
        ? view.children
        : []
  const slotFrames = rawSlots.map(normalizeStreamLayoutSlot).filter(Boolean)
  const slots = slotFrames.map((slot) => slot.id)

  return {
    ...layout,
    view: {
      type: view.type || layout.type || 'row',
      ...(view.padding !== undefined && { padding: view.padding })
    },
    slots,
    slotFrames
  }
}

function normalizeStreamLayoutSlot(slot, index) {
  if (typeof slot === 'string' || typeof slot === 'number') {
    return { id: String(slot) }
  }

  if (!slot || typeof slot !== 'object') return null
  const id = slot.id || slot.slot || slot.key || `chart-${index + 1}`
  return {
    ...slot,
    id: String(id),
    ...(Number.isFinite(Number(slot.x)) && { x: Number(slot.x) }),
    ...(Number.isFinite(Number(slot.y)) && { y: Number(slot.y) }),
    ...(Number.isFinite(Number(slot.width)) && { width: Number(slot.width) }),
    ...(Number.isFinite(Number(slot.height)) && { height: Number(slot.height) })
  }
}

function assembleStreamSpec({ layout, chartOrder, charts, title }) {
  const orderedIds = layout?.slots?.length ? layout.slots : chartOrder
  const children = orderedIds
    .map((id) => charts.get(id)?.spec)
    .filter((spec) => spec && typeof spec === 'object')

  if (children.length === 0) return null
  if (!layout && children.length === 1) return children[0]

  return {
    ...(title && { title }),
    ...(layout?.width && { width: layout.width }),
    ...(layout?.height && { height: layout.height }),
    ...(layout?.padding !== undefined && { padding: layout.padding }),
    view: {
      type: layout?.view?.type || 'row',
      ...(layout?.view?.padding !== undefined && {
        padding: layout.view.padding
      }),
      children
    }
  }
}

export async function streamPlotSpec({
  prompt,
  provider,
  render = renderAISpec,
  renderOptions,
  streamFormat = 'json',
  buffer = streamFormat === 'ndjson'
    ? createPlotSpecNDJSONBuffer()
    : createPlotSpecChunkBuffer(),
  signal,
  onStart,
  onChunk,
  onEvent,
  onLayout,
  onChart,
  onParseError,
  onValidationError,
  onSpec,
  onRender,
  onComplete,
  onError,
  validate = false,
  validateOptions
}) {
  try {
    if (!prompt || !String(prompt).trim()) {
      throw new Error('streamPlotSpec requires a non-empty prompt.')
    }

    onStart?.({ prompt })

    const source = await requestProviderStream(provider, prompt, { signal })
    const validator = resolveSpecValidator(validate)
    const eventState =
      streamFormat === 'ndjson' ? createPlotSpecStreamEventState() : null
    let result = null
    let spec = null

    for await (const chunk of readTextChunks(source)) {
      if (!chunk) continue

      const parsed = buffer.push(chunk)
      const text = buffer.getText()
      onChunk?.(chunk, text)

      if (eventState) {
        for (const event of parsed) {
          const validationEvent =
            event.type === 'chart'
              ? validateStreamChartEvent(event, validator, validateOptions)
              : null
          if (validationEvent) {
            const snapshot = eventState.apply(null)
            onEvent?.(validationEvent, snapshot, text)
            onValidationError?.(validationEvent, snapshot, text)
            continue
          }

          const snapshot = eventState.apply(event)
          onEvent?.(event, snapshot, text)
          if (event.type === 'layout') onLayout?.(event, snapshot, text)
          if (event.type === 'chart') onChart?.(event, snapshot, text)
          if (event.type === 'parse-error') {
            onParseError?.(event, snapshot, text)
          }

          if (snapshot.spec && snapshot.spec !== spec) {
            const validationError = validateSpecEvent(
              snapshot.spec,
              validator,
              validateOptions
            )
            if (validationError) {
              onEvent?.(validationError, snapshot, text)
              onValidationError?.(validationError, snapshot, text)
              continue
            }

            spec = snapshot.spec
            onSpec?.(spec, text, snapshot)
            result = render(spec, renderOptions)
            onRender?.(result, spec, text, snapshot)
          }
        }
        continue
      }

      spec = parsed
      if (spec) {
        assertStreamSpecValid(spec, validator, validateOptions)
        onSpec?.(spec, text)
        result = render(spec, renderOptions)
        onRender?.(result, spec, text)
      }
    }

    if (eventState) {
      for (const event of buffer.finish()) {
        const validationEvent =
          event.type === 'chart'
            ? validateStreamChartEvent(event, validator, validateOptions)
            : null
        if (validationEvent) {
          const snapshot = eventState.apply(null)
          const text = buffer.getText()
          onEvent?.(validationEvent, snapshot, text)
          onValidationError?.(validationEvent, snapshot, text)
          continue
        }

        const snapshot = eventState.apply(event)
        const text = buffer.getText()
        onEvent?.(event, snapshot, text)
        if (event.type === 'layout') onLayout?.(event, snapshot, text)
        if (event.type === 'chart') onChart?.(event, snapshot, text)
        if (event.type === 'parse-error') {
          onParseError?.(event, snapshot, text)
        }
        if (snapshot.spec && snapshot.spec !== spec) {
          const validationError = validateSpecEvent(
            snapshot.spec,
            validator,
            validateOptions
          )
          if (validationError) {
            onEvent?.(validationError, snapshot, text)
            onValidationError?.(validationError, snapshot, text)
            continue
          }

          spec = snapshot.spec
          onSpec?.(spec, text, snapshot)
          result = render(spec, renderOptions)
          onRender?.(result, spec, text, snapshot)
        }
      }
      spec = eventState.getSpec() || buffer.getSpec?.() || null
    } else {
      spec = buffer.finish()
    }

    if (!spec) {
      throw new Error(
        'Provider output did not contain a valid SparrowPlotSpec JSON object.'
      )
    }

    if (!result) {
      assertStreamSpecValid(spec, validator, validateOptions)
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
        buildOpenAICompatibleRequestURL(baseURL),
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

function resolveSpecValidator(validate) {
  if (!validate) return null
  if (validate === true) return validateSparrowSpec
  if (typeof validate === 'function') return validate
  throw new Error('streamPlotSpec validate must be true, false, or a function.')
}

function validateStreamChartEvent(event, validator, validateOptions) {
  if (!validator) return null

  const validationError = validateSpecEvent(event.spec, validator, {
    ...validateOptions,
    allowViewChild: true
  })
  if (!validationError) return null

  return {
    ...validationError,
    id: event.id || event.slot || event.key || null,
    slot: event.slot,
    key: event.key,
    chartId: event.chartId,
    spec: event.spec
  }
}

function validateSpecEvent(spec, validator, validateOptions) {
  if (!validator) return null

  const report = validator(spec, validateOptions)
  if (report?.valid !== false) return null

  return {
    type: 'validation-error',
    code: 'invalid_spec',
    recoverable: true,
    validation: report,
    message: formatValidationReport(report),
    spec
  }
}

function assertStreamSpecValid(spec, validator, validateOptions) {
  if (!validator) return

  const report = validator(spec, validateOptions)
  if (report?.valid === false) {
    throw new SparrowSpecValidationError(report)
  }
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
    return content.map((item) => item?.text || item?.content || '').join('')
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
  if (chunk instanceof Uint8Array)
    return decoder.decode(chunk, { stream: true })
  if (ArrayBuffer.isView(chunk)) return decoder.decode(chunk, { stream: true })
  if (chunk instanceof ArrayBuffer) {
    return decoder.decode(new Uint8Array(chunk), { stream: true })
  }
  return String(chunk || '')
}

function createMockSpec(prompt) {
  const normalized = String(prompt || '').toLowerCase()

  if (
    containsAny(normalized, [
      'dashboard',
      'panel',
      'compare',
      'comparison',
      'layout'
    ])
  ) {
    return {
      width: 900,
      height: 360,
      padding: 24,
      view: {
        type: 'row',
        padding: 24,
        children: [
          {
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
          },
          {
            plot: {
              type: 'line',
              data: [
                { month: 'Jan', value: 16 },
                { month: 'Feb', value: 22 },
                { month: 'Mar', value: 28 },
                { month: 'Apr', value: 26 }
              ],
              encodings: {
                x: 'month',
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
              x: { label: 'Month' },
              y: { label: 'Trend', grid: true }
            }
          }
        ]
      }
    }
  }
  if (
    containsAny(normalized, ['line', 'trend', '\u8d70\u52bf', '\u8d8b\u52bf'])
  ) {
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

  if (
    containsAny(normalized, [
      'point',
      'scatter',
      '\u5206\u5e03',
      '\u6563\u70b9'
    ])
  ) {
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
