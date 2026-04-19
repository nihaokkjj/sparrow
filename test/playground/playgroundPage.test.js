import { expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  renderAISpec: vi.fn(() => ({
    node: null,
    stopAnimations: vi.fn()
  })),
  streamPlotSpec: vi.fn(async ({ render, onSpec, onRender }) => {
    const spec = {
      plot: {
        type: 'point',
        data: [{ x: 1, y: 2 }],
        encodings: { x: 'x', y: 'y' }
      }
    }

    onSpec?.(spec)
    const result = render ? render(spec, { container: document.getElementById('preview') }) : { node: null }
    onRender?.(result, spec)

    return { spec, result }
  }),
  exportSpecAsPNG: vi.fn(async () => {}),
  exportSpecAsAPNG: vi.fn(async () => {})
}))

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
  createOpenAICompatibleProvider: () => ({
    stream: async function* () {}
  }),
  createPlotSpecChunkBuffer: () => ({
    push: () => null,
    finish: () => null
  }),
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

test('playground page script works with the current index.html DOM contract', async () => {
  vi.resetModules()
  document.body.innerHTML = createPageDOM()
  localStorage.clear()

  await import('../../src/playground-page.js')

  expect(document.getElementById('promptPreset').children).toHaveLength(1)
  expect(document.getElementById('summary').hidden).toBe(true)

  const exportButton = document.getElementById('export-menu-button')
  exportButton.disabled = false
  exportButton.click()
  expect(document.getElementById('export-dropdown').classList.contains('open')).toBe(true)

  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(document.getElementById('export-dropdown').classList.contains('open')).toBe(false)

  document
    .getElementById('controls')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(mocks.streamPlotSpec).toHaveBeenCalledTimes(1)
  expect(document.getElementById('status-text').textContent).toContain('完成')
  expect(document.getElementById('status-dot')).not.toBeNull()
  expect(document.getElementById('summary').hidden).toBe(false)
  expect(document.getElementById('summary').textContent).toContain('1 条数据')
})
