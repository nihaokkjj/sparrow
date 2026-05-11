import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const defaultStreamPlotSpec = async ({
    render,
    onLayout,
    onChart,
    onSpec,
    onRender,
    streamFormat
  }) => {
    const chartSpec = {
      plot: {
        type: 'point',
        data: [{ x: 1, y: 2 }],
        encodings: { x: 'x', y: 'y' }
      }
    }
    const spec = {
      view: {
        type: 'row',
        children: [chartSpec]
      }
    }
    const layout = {
      slots: [{ id: 'main', x: 0, y: 0, width: 320, height: 240 }],
      slotFrames: [{ id: 'main', x: 0, y: 0, width: 320, height: 240 }]
    }
    const snapshot = { layout, spec, charts: [{ id: 'main', spec: chartSpec }] }

    if (streamFormat === 'ndjson') {
      onLayout?.({ type: 'layout', layout }, snapshot)
      onChart?.({ type: 'chart', id: 'main', spec: chartSpec }, snapshot)
    }

    onSpec?.(spec)
    const result = render
      ? render(spec, { container: document.getElementById('preview') })
      : { node: null }
    onRender?.(result, spec)

    return { spec, result }
  }

  return {
    defaultStreamPlotSpec,
    renderAISpec: vi.fn(() => ({
      node: null,
      stopAnimations: vi.fn()
    })),
    streamPlotSpec: vi.fn(defaultStreamPlotSpec),
    exportSpecAsPNG: vi.fn(async () => {}),
    exportSpecAsAPNG: vi.fn(async () => {})
  }
})

vi.mock('../../src/plot/index.js', () => ({
  DEFAULT_PLOT_SPEC_PROMPT_PRESET: 'minimal',
  DEFAULT_PLAYGROUND_PROVIDER: 'zhipu',
  applyPlaygroundAnimationPreference: (spec) => spec,
  buildProviderRequestConfig: ({ connectionMode }) => ({
    connectionMode,
    baseURL:
      connectionMode === 'direct'
        ? 'https://api.example.com/v1'
        : '/api/openai',
    headers: {}
  }),
  createOpenAICompatibleProvider: vi.fn((config) => ({
    config,
    stream: async function* () {}
  })),
  createRAGPlotProvider: vi.fn((provider) => provider),
  getDefaultPlaygroundProviderSettings: () => ({
    connectionMode: 'proxy',
    targetBaseURL: '',
    model: 'demo-model',
    proxyBaseURL: '/api/openai'
  }),
  getPlaygroundProviderProfile: () => ({
    directTargetPlaceholder: 'https://api.example.com/v1',
    proxyTargetPlaceholder: '留空使用默认',
    directHint: '直连提示',
    proxyHint: '代理提示'
  }),
  getPlotSpecPromptPreset: (id = 'minimal') => ({
    id,
    label: 'Minimal',
    description: '最小模式',
    systemPrompt: 'system prompt'
  }),
  listPlotSpecPromptPresets: () => [
    {
      id: 'minimal',
      label: 'Minimal',
      description: '最小模式',
      systemPrompt: 'system prompt'
    }
  ],
  normalizePlaygroundProvider: (value) =>
    value === 'openai' ? 'openai' : 'zhipu',
  renderAISpec: mocks.renderAISpec,
  streamPlotSpec: mocks.streamPlotSpec
}))

vi.mock('../../src/playground/exportImage.js', () => ({
  exportSpecAsAPNG: mocks.exportSpecAsAPNG,
  exportSpecAsPNG: mocks.exportSpecAsPNG
}))

function createPageDOM() {
  return `
    <form id="controls">
      <textarea id="prompt">画一个散点图</textarea>
      <input id="canvasWidth" value="640" />
      <input id="canvasHeight" value="480" />
      <select id="promptPreset"></select>
      <select id="provider"><option value="zhipu">zhipu</option></select>
      <select id="connectionMode"><option value="proxy">proxy</option><option value="direct">direct</option></select>
      <input id="targetBaseURL" value="" />
      <input id="model" value="demo-model" />
      <input id="apiKey" value="" />
      <input id="animateRender" type="checkbox" />
      <input id="autoLayout" type="checkbox" checked />
      <input id="ragKnowledge" type="checkbox" checked />
      <button id="run" type="submit">run</button>
      <button id="stop" type="button" disabled>stop</button>
    </form>
    <button id="rerender" disabled>rerender</button>
    <div class="dropdown" id="export-dropdown">
      <button id="export-menu-button" disabled>export</button>
      <div class="dropdown-menu">
        <button id="export-image">png</button>
        <button id="export-apng">apng</button>
      </div>
    </div>
    <div class="status">
      <div class="status-dot" id="status-dot"></div>
      <span id="status-text">等待输入提示词</span>
    </div>
    <span id="summary" class="hidden">暂无图表规范</span>
    <pre id="stream-log"></pre>
    <pre id="spec-json"></pre>
    <div id="preview"></div>
  `
}

beforeEach(() => {
  vi.resetModules()
  document.body.innerHTML = ''
  localStorage.clear()
  mocks.renderAISpec.mockClear()
  mocks.exportSpecAsPNG.mockClear()
  mocks.exportSpecAsAPNG.mockClear()
  mocks.streamPlotSpec.mockReset()
  mocks.streamPlotSpec.mockImplementation(mocks.defaultStreamPlotSpec)
})

test('playground page asks the model to repair missing stream chart slots once', async () => {
  const barSpec = {
    plot: {
      type: 'interval',
      data: [{ category: 'A', value: 3 }],
      encodings: { x: 'category', y: 'value' }
    }
  }
  const trendSpec = {
    plot: {
      type: 'line',
      data: [{ step: 'Q1', value: 2 }],
      encodings: { x: 'step', y: 'value' }
    }
  }
  const layout = {
    type: 'row',
    slots: [
      { id: 'bars', x: 0, y: 0, width: 320, height: 240 },
      { id: 'trend', x: 320, y: 0, width: 320, height: 240 }
    ],
    slotFrames: [
      { id: 'bars', x: 0, y: 0, width: 320, height: 240 },
      { id: 'trend', x: 320, y: 0, width: 320, height: 240 }
    ]
  }

  mocks.streamPlotSpec
    .mockImplementationOnce(
      async ({ render, onLayout, onChart, onSpec, onRender, onParseError }) => {
        const spec = { view: { type: 'row', children: [barSpec] } }
        const snapshot = {
          layout,
          spec,
          charts: [{ id: 'bars', spec: barSpec }]
        }

        onLayout?.({ type: 'layout', layout }, snapshot)
        onChart?.({ type: 'chart', id: 'bars', spec: barSpec }, snapshot)
        onParseError?.(
          { type: 'parse-error', code: 'invalid_json', lineNumber: 3 },
          snapshot
        )
        onSpec?.(spec)
        const result = render(spec, {
          container: document.getElementById('preview')
        })
        onRender?.(result, spec)

        return { spec, result }
      }
    )
    .mockImplementationOnce(async ({ prompt, render, onChart }) => {
      expect(prompt).toContain('Failed chart ids: ["trend"]')
      expect(prompt).toContain('Do not output layout')

      const event = { type: 'chart', id: 'trend', spec: trendSpec }
      onChart?.(event, {
        layout,
        spec: trendSpec,
        charts: [{ id: 'trend', spec: trendSpec }]
      })

      return { spec: trendSpec, result: render(trendSpec) }
    })

  document.body.innerHTML = createPageDOM()
  await import('../../src/playground-page.js')

  document
    .getElementById('controls')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(mocks.streamPlotSpec).toHaveBeenCalledTimes(2)
  expect(document.querySelector('[data-slot="bars"]')).not.toBeNull()
  expect(document.querySelector('[data-slot="trend"]')).not.toBeNull()
  expect(mocks.renderAISpec).toHaveBeenCalledWith(
    expect.objectContaining({ width: 320, height: 240 }),
    expect.objectContaining({
      container: document.querySelector('[data-slot="trend"]'),
      width: 320,
      height: 240
    })
  )
  expect(document.getElementById('spec-json').textContent).toContain('"line"')
})

test('playground page keeps empty stream slots visible as placeholders', async () => {
  const barSpec = {
    plot: {
      type: 'interval',
      data: [{ category: 'A', value: 3 }],
      encodings: { x: 'category', y: 'value' }
    }
  }
  const trendSpec = {
    plot: {
      type: 'line',
      data: [{ step: 'Q1', value: 2 }],
      encodings: { x: 'step', y: 'value' }
    }
  }
  const layout = {
    type: 'row',
    slots: [
      { id: 'bars', x: 0, y: 0, width: 160, height: 240 },
      { id: 'trend', x: 160, y: 0, width: 160, height: 240 },
      { id: 'forecast', x: 320, y: 0, width: 160, height: 240 },
      { id: 'summary', x: 480, y: 0, width: 160, height: 240 }
    ],
    slotFrames: [
      { id: 'bars', x: 0, y: 0, width: 160, height: 240 },
      { id: 'trend', x: 160, y: 0, width: 160, height: 240 },
      { id: 'forecast', x: 320, y: 0, width: 160, height: 240 },
      { id: 'summary', x: 480, y: 0, width: 160, height: 240 }
    ]
  }

  mocks.streamPlotSpec
    .mockImplementationOnce(
      async ({ render, onLayout, onChart, onSpec, onRender }) => {
        const spec = { view: { type: 'row', children: [barSpec, trendSpec] } }
        const snapshot = {
          layout,
          spec,
          charts: [
            { id: 'bars', spec: barSpec },
            { id: 'trend', spec: trendSpec }
          ]
        }

        onLayout?.({ type: 'layout', layout }, snapshot)
        onChart?.({ type: 'chart', id: 'bars', spec: barSpec }, snapshot)
        onChart?.({ type: 'chart', id: 'trend', spec: trendSpec }, snapshot)
        onSpec?.(spec)
        const result = render(spec, {
          container: document.getElementById('preview')
        })
        onRender?.(result, spec)

        return { spec, result }
      }
    )
    .mockImplementationOnce(async ({ prompt }) => {
      expect(prompt).toContain('Failed chart ids: ["forecast","summary"]')
      return { spec: null, result: { node: null } }
    })

  document.body.innerHTML = createPageDOM()
  await import('../../src/playground-page.js')

  document
    .getElementById('controls')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(document.querySelectorAll('.stream-slot-preview__slot')).toHaveLength(
    4
  )
  expect(
    document.querySelector(
      '[data-slot="forecast"] .stream-slot-preview__placeholder'
    )
  ).not.toBeNull()
  expect(
    document.querySelector(
      '[data-slot="summary"] .stream-slot-preview__placeholder'
    )
  ).not.toBeNull()
})

test('playground page animates failed stream slots while repair is pending', async () => {
  const barSpec = {
    plot: {
      type: 'interval',
      data: [{ category: 'A', value: 3 }],
      encodings: { x: 'category', y: 'value' }
    }
  }
  const trendSpec = {
    plot: {
      type: 'line',
      data: [{ step: 'Q1', value: 2 }],
      encodings: { x: 'step', y: 'value' }
    }
  }
  const layout = {
    type: 'row',
    slots: [
      { id: 'bars', x: 0, y: 0, width: 160, height: 240 },
      { id: 'trend', x: 160, y: 0, width: 160, height: 240 },
      { id: 'forecast', x: 320, y: 0, width: 160, height: 240 },
      { id: 'summary', x: 480, y: 0, width: 160, height: 240 }
    ],
    slotFrames: [
      { id: 'bars', x: 0, y: 0, width: 160, height: 240 },
      { id: 'trend', x: 160, y: 0, width: 160, height: 240 },
      { id: 'forecast', x: 320, y: 0, width: 160, height: 240 },
      { id: 'summary', x: 480, y: 0, width: 160, height: 240 }
    ]
  }
  let resolveRepair

  mocks.streamPlotSpec
    .mockImplementationOnce(
      async ({ render, onLayout, onChart, onSpec, onRender }) => {
        const spec = { view: { type: 'row', children: [barSpec, trendSpec] } }
        const snapshot = {
          layout,
          spec,
          charts: [
            { id: 'bars', spec: barSpec },
            { id: 'trend', spec: trendSpec }
          ]
        }

        onLayout?.({ type: 'layout', layout }, snapshot)
        onChart?.({ type: 'chart', id: 'bars', spec: barSpec }, snapshot)
        onChart?.({ type: 'chart', id: 'trend', spec: trendSpec }, snapshot)
        onSpec?.(spec)
        const result = render(spec, {
          container: document.getElementById('preview')
        })
        onRender?.(result, spec)

        return { spec, result }
      }
    )
    .mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          resolveRepair = resolve
        })
    )

  document.body.innerHTML = createPageDOM()
  await import('../../src/playground-page.js')

  document
    .getElementById('controls')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(mocks.streamPlotSpec).toHaveBeenCalledTimes(2)
  const forecastSlot = document.querySelector('[data-slot="forecast"]')
  const placeholder = forecastSlot.querySelector(
    '.stream-slot-preview__placeholder'
  )
  expect(forecastSlot.classList.contains('is-retrying')).toBe(true)
  expect(placeholder.dataset.state).toBe('retrying')
  expect(
    forecastSlot.querySelector('.stream-slot-preview__retry-spinner').hidden
  ).toBe(false)
  expect(
    forecastSlot.querySelector('.stream-slot-preview__hint').textContent
  ).toBe('Retrying')

  resolveRepair({ spec: null, result: { node: null } })
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(forecastSlot.classList.contains('is-retry-failed')).toBe(true)
  expect(
    forecastSlot.querySelector('.stream-slot-preview__hint').textContent
  ).toBe('Retry failed')
})

test('playground page script works with the current index.html DOM contract', async () => {
  document.body.innerHTML = createPageDOM()

  await import('../../src/playground-page.js')

  expect(document.getElementById('promptPreset').children).toHaveLength(1)
  expect(document.getElementById('summary').hidden).toBe(true)

  const exportButton = document.getElementById('export-menu-button')
  exportButton.disabled = false
  exportButton.click()
  expect(
    document.getElementById('export-dropdown').classList.contains('open')
  ).toBe(true)

  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(
    document.getElementById('export-dropdown').classList.contains('open')
  ).toBe(false)

  document
    .getElementById('controls')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(mocks.streamPlotSpec).toHaveBeenCalledTimes(1)
  expect(mocks.streamPlotSpec.mock.calls[0][0].streamFormat).toBe('ndjson')
  expect(mocks.streamPlotSpec.mock.calls[0][0].onLayout).toEqual(
    expect.any(Function)
  )
  expect(mocks.streamPlotSpec.mock.calls[0][0].onChart).toEqual(
    expect.any(Function)
  )
  expect(mocks.streamPlotSpec.mock.calls[0][0].onParseError).toEqual(
    expect.any(Function)
  )
  expect(document.getElementById('status-text').textContent).toContain('完成')
  mocks.streamPlotSpec.mock.calls[0][0].onParseError(
    { type: 'parse-error', lineNumber: 4 },
    { charts: [{ id: 'main' }] }
  )
  expect(document.getElementById('status-text').textContent).toContain(
    'Skipped 1 invalid JSON line(s) at line 4'
  )
  expect(document.getElementById('status-dot')).not.toBeNull()
  expect(document.querySelector('[data-slot="main"]')).not.toBeNull()
  expect(mocks.renderAISpec).toHaveBeenCalledWith(
    expect.objectContaining({ width: 320, height: 240 }),
    expect.objectContaining({
      container: document.querySelector('[data-slot="main"]'),
      width: 320,
      height: 240
    })
  )
  const renderCount = mocks.renderAISpec.mock.calls.length
  document.getElementById('rerender').click()
  expect(mocks.renderAISpec).toHaveBeenCalledTimes(renderCount + 1)
  expect(document.querySelector('[data-slot="main"]')).not.toBeNull()
  document.getElementById('export-image').click()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(mocks.exportSpecAsPNG).toHaveBeenCalledWith(
    expect.objectContaining({ width: 640, height: 480 }),
    expect.objectContaining({ render: expect.any(Function) })
  )
  expect(document.getElementById('summary').hidden).toBe(false)
  expect(document.getElementById('summary').textContent).toContain('1 条数据')
})
