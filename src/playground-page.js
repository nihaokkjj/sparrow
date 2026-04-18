import {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  buildProviderRequestConfig,
  createMockPlotProvider,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  getDefaultPlaygroundProviderSettings,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets,
  renderAISpec,
  applyPlaygroundAnimationPreference,
  streamPlotSpec
} from './plot/index.js'
import { exportSpecAsPNG } from './playground/exportImage.js'

const form = document.getElementById('controls')
const promptInput = document.getElementById('prompt')
const canvasWidthInput = document.getElementById('canvasWidth')
const canvasHeightInput = document.getElementById('canvasHeight')
const promptPresetSelect = document.getElementById('promptPreset')
const promptPresetHint = document.getElementById('prompt-preset-hint')
const providerSelect = document.getElementById('provider')
const providerConfig = document.getElementById('provider-config')
const connectionModeSelect = document.getElementById('connectionMode')
const targetBaseURLInput = document.getElementById('targetBaseURL')
const connectionModeHint = document.getElementById('connection-mode-hint')
const modelInput = document.getElementById('model')
const apiKeyInput = document.getElementById('apiKey')
const animateRenderInput = document.getElementById('animateRender')
const autoLayoutInput = document.getElementById('autoLayout')
const runButton = document.getElementById('run')
const stopButton = document.getElementById('stop')
const rerenderButton = document.getElementById('rerender')
const exportImageButton = document.getElementById('export-image')
const statusNode = document.getElementById('status')
const summaryNode = document.getElementById('summary')
const streamLogNode = document.getElementById('stream-log')
const specJsonNode = document.getElementById('spec-json')
const previewNode = document.getElementById('preview')
const env = import.meta.env || {}
const providerSettingsKey = 'sparrow.playground.provider-settings'
const defaultProviderSettings = getDefaultPlaygroundProviderSettings(env)

let controller = null
let lastRenderedSpec = null
let lastRenderResult = null
let lastRenderedDimensions = null
let isExportingImage = false

function cloneSpec(spec) {
  if (spec === null || spec === undefined) return spec
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(spec)
  }
  return JSON.parse(JSON.stringify(spec))
}

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
      promptPreset: promptPresetSelect.value,
      connectionMode: connectionModeSelect.value,
      targetBaseURL: targetBaseURLInput.value.trim(),
      model: modelInput.value.trim(),
      animateRender: animateRenderInput.checked,
      autoLayout: autoLayoutInput.checked
    })
  )
}

function getEffectiveSpec(spec) {
  return applyPlaygroundAnimationPreference(spec, {
    enabled: animateRenderInput.checked
  })
}

function getRenderPreferences() {
  return {
    autoLayout: autoLayoutInput.checked
  }
}

function syncChartActionButtons() {
  const hasRenderedSpec = Boolean(lastRenderedSpec)
  rerenderButton.disabled = !hasRenderedSpec
  exportImageButton.disabled = !hasRenderedSpec || isExportingImage
}

function rememberRenderedSpec(spec, dimensions) {
  lastRenderedSpec = cloneSpec(spec)
  lastRenderedDimensions = dimensions ? { ...dimensions } : null
  syncChartActionButtons()
}

function clearRenderedSpec() {
  lastRenderedSpec = null
  lastRenderResult = null
  lastRenderedDimensions = null
  isExportingImage = false
  syncChartActionButtons()
}

function renderStoredSpec() {
  if (!lastRenderedSpec) {
    statusNode.textContent = 'No JSON spec to re-render yet.'
    statusNode.className = 'status'
    return
  }

  try {
    lastRenderResult?.stopAnimations?.()
    lastRenderResult = renderAISpec(cloneSpec(lastRenderedSpec), {
      container: previewNode,
      ...getRenderPreferences(),
      ...(lastRenderedDimensions || {})
    })

    const { typeLabel, layoutLabel } = summarizeSpec(lastRenderedSpec)
    statusNode.textContent = layoutLabel
      ? `Re-rendered ${layoutLabel} view with ${typeLabel} marks from the existing JSON object.`
      : `Re-rendered ${typeLabel} chart from the existing JSON object.`
    statusNode.className = 'status ok'
  } catch (error) {
    statusNode.textContent = error?.message || 'Re-render failed.'
    statusNode.className = 'status error'
  }
}

async function exportRenderedImage() {
  if (!lastRenderedSpec) {
    statusNode.textContent = 'No JSON spec to export yet.'
    statusNode.className = 'status'
    return
  }

  isExportingImage = true
  syncChartActionButtons()
  statusNode.textContent = 'Exporting PNG image…'
  statusNode.className = 'status live'

  try {
    await exportSpecAsPNG(cloneSpec(lastRenderedSpec), {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      filename: createExportFilename()
    })

    statusNode.textContent = 'Downloaded PNG image from the latest chart.'
    statusNode.className = 'status ok'
  } catch (error) {
    statusNode.textContent = error?.message || 'PNG export failed.'
    statusNode.className = 'status error'
  } finally {
    isExportingImage = false
    syncChartActionButtons()
  }
}

function createExportFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `sparrow-chart-${timestamp}.png`
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

function populatePromptPresetOptions() {
  const presets = listPlotSpecPromptPresets()
  promptPresetSelect.replaceChildren(
    ...presets.map((preset) => {
      const option = document.createElement('option')
      option.value = preset.id
      option.textContent = preset.label
      return option
    })
  )
}

function syncPromptPresetUI() {
  const preset = getPlotSpecPromptPreset(promptPresetSelect.value)
  promptPresetHint.textContent = preset.description
}

function initializeProviderSettings() {
  const stored = readStoredProviderSettings()
  promptPresetSelect.value =
    typeof stored.promptPreset === 'string'
      ? getPlotSpecPromptPreset(stored.promptPreset).id
      : DEFAULT_PLOT_SPEC_PROMPT_PRESET
  connectionModeSelect.value =
    stored.connectionMode === 'direct'
      ? 'direct'
      : defaultProviderSettings.connectionMode
  targetBaseURLInput.value =
    typeof stored.targetBaseURL === 'string'
      ? stored.targetBaseURL
      : defaultProviderSettings.targetBaseURL
  modelInput.value = stored.model || defaultProviderSettings.model
  animateRenderInput.checked = stored.animateRender === true
  autoLayoutInput.checked = stored.autoLayout !== false
  syncPromptPresetUI()
  syncConnectionModeUI()
}

populatePromptPresetOptions()
initializeProviderSettings()

providerSelect.addEventListener('change', () => {
  providerConfig.classList.toggle(
    'hidden',
    providerSelect.value !== 'openai-compatible'
  )
})

promptPresetSelect.addEventListener('change', () => {
  syncPromptPresetUI()
  persistProviderSettings()
})

connectionModeSelect.addEventListener('change', () => {
  syncConnectionModeUI()
  persistProviderSettings()
})

targetBaseURLInput.addEventListener('input', persistProviderSettings)
modelInput.addEventListener('input', persistProviderSettings)
animateRenderInput.addEventListener('change', persistProviderSettings)
autoLayoutInput.addEventListener('change', () => {
  persistProviderSettings()
  if (lastRenderedSpec) {
    renderStoredSpec()
  }
})

stopButton.addEventListener('click', () => {
  controller?.abort()
})

rerenderButton.addEventListener('click', renderStoredSpec)
exportImageButton.addEventListener('click', () => {
  void exportRenderedImage()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const prompt = promptInput.value.trim()
  if (!prompt) return

  controller?.abort()
  controller = new AbortController()

  const buffer = createPlotSpecChunkBuffer()
  const promptPreset = getPlotSpecPromptPreset(promptPresetSelect.value)
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
      model: modelInput.value.trim() || defaultProviderSettings.model,
      systemPrompt: promptPreset.systemPrompt
    })
    persistProviderSettings()
  }

  runButton.disabled = true
  stopButton.disabled = false
  clearRenderedSpec()
  statusNode.textContent = 'Streaming model output…'
  statusNode.className = 'status live'
  summaryNode.textContent = 'Waiting for JSON'
  streamLogNode.textContent = ''
  specJsonNode.textContent = ''
  previewNode.innerHTML =
    '<div class="preview-empty">Streaming and parsing…</div>'

  try {
    const canvasWidth = parseInt(canvasWidthInput.value) || 640
    const canvasHeight = parseInt(canvasHeightInput.value) || 480

    previewNode.style.width = canvasWidth + 'px'
    previewNode.style.height = canvasHeight + 'px'
    previewNode.style.margin = '0 auto'

    const promptWithSize = `画布尺寸: ${canvasWidth}x${canvasHeight}。${prompt}`

    const result = await streamPlotSpec({
      prompt: promptWithSize,
      provider,
      buffer,
      signal: controller.signal,
      render(spec, renderOptions) {
        const effectiveSpec = getEffectiveSpec(spec)
        const specWithSize = {
          ...effectiveSpec,
          width: canvasWidth,
          height: canvasHeight
        }
        return renderAISpec(specWithSize, {
          ...renderOptions,
          ...getRenderPreferences(),
          width: canvasWidth,
          height: canvasHeight
        })
      },
      renderOptions: {
        container: previewNode,
        ...getRenderPreferences(),
        width: canvasWidth,
        height: canvasHeight
      },
      onChunk(chunk, text) {
        streamLogNode.textContent = text
      },
      onSpec(spec) {
        const effectiveSpec = getEffectiveSpec(spec)
        rememberRenderedSpec(effectiveSpec, {
          width: canvasWidth,
          height: canvasHeight
        })
        specJsonNode.textContent = JSON.stringify(effectiveSpec, null, 2)
        const { typeLabel, count, layoutLabel } = summarizeSpec(effectiveSpec)
        summaryNode.textContent = layoutLabel
          ? `${layoutLabel} view · ${typeLabel} · ${count} rows`
          : `${typeLabel} · ${count} rows`
      },
      onRender(result, spec) {
        lastRenderResult = result
        const effectiveSpec = getEffectiveSpec(spec)
        const { typeLabel, layoutLabel } = summarizeSpec(effectiveSpec)
        const animationSuffix = animateRenderInput.checked
          ? ' with animation'
          : ''
        statusNode.textContent = layoutLabel
          ? `Rendered ${layoutLabel} view with ${typeLabel} marks${animationSuffix} from the latest valid JSON object.`
          : `Rendered ${typeLabel} chart${animationSuffix} from the latest valid JSON object.`
        statusNode.className = 'status ok'
      }
    })

    const effectiveSpec = getEffectiveSpec(result.spec)
    const { typeLabel, layoutLabel } = summarizeSpec(effectiveSpec)
    const animationSuffix = animateRenderInput.checked
      ? ' 并播放了入场动画'
      : ''
    statusNode.textContent = layoutLabel
      ? `Done. Parsed and rendered ${layoutLabel} view with ${typeLabel}${animationSuffix}.`
      : `Done. Parsed and rendered ${typeLabel}${animationSuffix}.`
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
