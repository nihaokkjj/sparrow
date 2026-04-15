import {
  buildProviderRequestConfig,
  createMockPlotProvider,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  getDefaultPlaygroundProviderSettings,
  streamPlotSpec
} from './plot/index.js'

const form = document.getElementById('controls')
const promptInput = document.getElementById('prompt')
const providerSelect = document.getElementById('provider')
const providerConfig = document.getElementById('provider-config')
const connectionModeSelect = document.getElementById('connectionMode')
const targetBaseURLInput = document.getElementById('targetBaseURL')
const connectionModeHint = document.getElementById('connection-mode-hint')
const modelInput = document.getElementById('model')
const apiKeyInput = document.getElementById('apiKey')
const runButton = document.getElementById('run')
const stopButton = document.getElementById('stop')
const statusNode = document.getElementById('status')
const summaryNode = document.getElementById('summary')
const streamLogNode = document.getElementById('stream-log')
const specJsonNode = document.getElementById('spec-json')
const previewNode = document.getElementById('preview')
const env = import.meta.env || {}
const providerSettingsKey = 'sparrow.playground.provider-settings'
const defaultProviderSettings = getDefaultPlaygroundProviderSettings(env)

let controller = null

function getSpecPlots(spec) {
  const plots = []
  visitSpecPlots(spec, plots)
  return plots
}

function visitSpecPlots(spec, plots) {
  if (!spec || typeof spec !== 'object') return
  if (Array.isArray(spec?.plots)) {
    plots.push(...spec.plots)
    return
  }
  if (Array.isArray(spec?.plot)) {
    plots.push(...spec.plot)
    return
  }
  if (spec?.plot) {
    plots.push(spec.plot)
    return
  }
  if (spec?.view) {
    visitViewPlots(spec.view, plots)
    return
  }
  if (
    Array.isArray(spec?.children) &&
    ['row', 'col', 'layer', 'facet'].includes(spec?.type)
  ) {
    visitViewPlots(spec, plots)
    return
  }
  if (spec?.type && Array.isArray(spec?.data)) {
    plots.push(spec)
  }
}

function visitViewPlots(view, plots) {
  if (!view || typeof view !== 'object') return
  if (!Array.isArray(view.children)) return
  view.children.forEach((child) => {
    visitSpecPlots(child, plots)
  })
}

function getLayoutLabel(spec) {
  const root = spec?.view || spec
  if (
    root &&
    typeof root === 'object' &&
    Array.isArray(root.children) &&
    ['row', 'col', 'layer', 'facet'].includes(root.type)
  ) {
    return root.type
  }
  return null
}

function summarizeSpec(spec) {
  const plots = getSpecPlots(spec)
  const types = plots.map((plot) => plot?.type || 'unknown')
  const count = plots.reduce(
    (total, plot) => total + (Array.isArray(plot?.data) ? plot.data.length : 0),
    0
  )
  return {
    typeLabel: types.length > 0 ? types.join(' + ') : 'unknown',
    count,
    layoutLabel: getLayoutLabel(spec)
  }
}

function readStoredProviderSettings() {
  try {
    return JSON.parse(localStorage.getItem(providerSettingsKey) || '{}')
  } catch {
    return {}
  }
}

function persistProviderSettings() {
  localStorage.setItem(
    providerSettingsKey,
    JSON.stringify({
      connectionMode: connectionModeSelect.value,
      targetBaseURL: targetBaseURLInput.value.trim(),
      model: modelInput.value.trim()
    })
  )
}

function syncConnectionModeUI() {
  const isDirect = connectionModeSelect.value === 'direct'
  targetBaseURLInput.placeholder = isDirect
    ? 'https://api.openai.com/v1 或你的中转站地址'
    : '填写你的中转站 / 官方接口；留空则使用服务端默认目标'
  connectionModeHint.textContent = isDirect
    ? '直连模式会由浏览器直接请求这里填写的兼容 OpenAI 地址；目标站点必须允许 CORS。'
    : '同源代理模式仍请求 /api/openai；如果填写自己的中转站，请同时填写自己的 API Key，服务端会用这组用户信息转发。'
}

function initializeProviderSettings() {
  const stored = readStoredProviderSettings()
  connectionModeSelect.value =
    stored.connectionMode === 'direct'
      ? 'direct'
      : defaultProviderSettings.connectionMode
  targetBaseURLInput.value =
    typeof stored.targetBaseURL === 'string'
      ? stored.targetBaseURL
      : defaultProviderSettings.targetBaseURL
  modelInput.value = stored.model || defaultProviderSettings.model
  syncConnectionModeUI()
}

initializeProviderSettings()

providerSelect.addEventListener('change', () => {
  providerConfig.classList.toggle(
    'hidden',
    providerSelect.value !== 'openai-compatible'
  )
})

connectionModeSelect.addEventListener('change', () => {
  syncConnectionModeUI()
  persistProviderSettings()
})

targetBaseURLInput.addEventListener('input', persistProviderSettings)
modelInput.addEventListener('input', persistProviderSettings)

stopButton.addEventListener('click', () => {
  controller?.abort()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const prompt = promptInput.value.trim()
  if (!prompt) return

  controller?.abort()
  controller = new AbortController()

  const buffer = createPlotSpecChunkBuffer()
  let provider = createMockPlotProvider()

  if (providerSelect.value === 'openai-compatible') {
    const requestConfig = buildProviderRequestConfig({
      connectionMode: connectionModeSelect.value,
      proxyBaseURL: defaultProviderSettings.proxyBaseURL,
      targetBaseURL: targetBaseURLInput.value.trim()
    })
    const usesUserProxyTarget =
      requestConfig.connectionMode === 'proxy' &&
      targetBaseURLInput.value.trim()
    const apiKey = apiKeyInput.value.trim()

    if (requestConfig.connectionMode === 'direct' && !requestConfig.baseURL) {
      statusNode.textContent = '直连模式下请先填写目标 Base URL。'
      statusNode.className = 'status error'
      return
    }

    if (usesUserProxyTarget && !apiKey) {
      statusNode.textContent = '使用自己的中转站时，请同时填写自己的 API Key。'
      statusNode.className = 'status error'
      return
    }

    provider = createOpenAICompatibleProvider({
      baseURL: requestConfig.baseURL,
      headers: requestConfig.headers,
      apiKey,
      model: modelInput.value.trim() || defaultProviderSettings.model
    })
    persistProviderSettings()
  }

  runButton.disabled = true
  stopButton.disabled = false
  statusNode.textContent = 'Streaming model output…'
  statusNode.className = 'status live'
  summaryNode.textContent = 'Waiting for JSON'
  streamLogNode.textContent = ''
  specJsonNode.textContent = ''
  previewNode.innerHTML =
    '<div class="preview-empty">Streaming and parsing…</div>'

  try {
    const result = await streamPlotSpec({
      prompt,
      provider,
      buffer,
      signal: controller.signal,
      renderOptions: {
        container: previewNode
      },
      onChunk(chunk, text) {
        streamLogNode.textContent = text
      },
      onSpec(spec) {
        specJsonNode.textContent = JSON.stringify(spec, null, 2)
        const { typeLabel, count, layoutLabel } = summarizeSpec(spec)
        summaryNode.textContent = layoutLabel
          ? `${layoutLabel} view · ${typeLabel} · ${count} rows`
          : `${typeLabel} · ${count} rows`
      },
      onRender(result, spec) {
        const { typeLabel, layoutLabel } = summarizeSpec(spec)
        statusNode.textContent = layoutLabel
          ? `Rendered ${layoutLabel} view with ${typeLabel} marks from the latest valid JSON object.`
          : `Rendered ${typeLabel} chart from the latest valid JSON object.`
        statusNode.className = 'status ok'
      }
    })

    const { typeLabel, layoutLabel } = summarizeSpec(result.spec)
    statusNode.textContent = layoutLabel
      ? `Done. Parsed and rendered ${layoutLabel} view with ${typeLabel}.`
      : `Done. Parsed and rendered ${typeLabel}.`
    statusNode.className = 'status ok'
  } catch (error) {
    if (error?.name === 'AbortError') {
      statusNode.textContent = 'Stream aborted.'
      statusNode.className = 'status'
    } else {
      statusNode.textContent = error?.message || 'Generation failed.'
      statusNode.className = 'status error'
    }
  } finally {
    runButton.disabled = false
    stopButton.disabled = true
  }
})
