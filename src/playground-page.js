import {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  buildProviderRequestConfig,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  getDefaultPlaygroundProviderSettings,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets,
  renderAISpec,
  applyPlaygroundAnimationPreference,
  streamPlotSpec
} from './plot/index.js'
import { exportSpecAsAPNG, exportSpecAsPNG } from './playground/exportImage.js'

const form = document.getElementById('controls')
const promptInput = document.getElementById('prompt')
const canvasWidthInput = document.getElementById('canvasWidth')
const canvasHeightInput = document.getElementById('canvasHeight')
const promptPresetSelect = document.getElementById('promptPreset')
const promptPresetHint = document.getElementById('prompt-preset-hint')
const providerSelect = document.getElementById('provider')
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
const exportAPNGButton = document.getElementById('export-apng')
const statusNode = document.getElementById('status')
const summaryNode = document.getElementById('summary')
const streamLogNode = document.getElementById('stream-log')
const specJsonNode = document.getElementById('spec-json')
const previewNode = document.getElementById('preview')
const env = import.meta.env || {}
const providerSettingsKey = 'sparrow.playground.provider-settings'
const providerSettingsVersion = 2
const defaultProviderSettings = getDefaultPlaygroundProviderSettings(env)

let controller = null
let lastRenderedSpec = null
let lastRenderResult = null
let lastRenderedDimensions = null
let isExportingImage = false

const markTypeLabels = Object.freeze({
  point: '点图',
  line: '折线图',
  interval: '柱状图',
  pie: '饼图',
  area: '面积图',
  rect: '矩形图',
  cell: '单元格图',
  text: '文本图',
  unknown: '未知图形'
})

const layoutTypeLabels = Object.freeze({
  row: '行布局视图',
  col: '列布局视图',
  layer: '叠加视图',
  facet: '分面视图'
})

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
    return layoutTypeLabels[root.type] || root.type
  }
  return null
}

function summarizeSpec(spec) {
  const plots = getSpecPlots(spec)
  const types = plots.map((plot) => {
    const type = plot?.type || 'unknown'
    return markTypeLabels[type] || type
  })
  const count = plots.reduce(
    (total, plot) => total + (Array.isArray(plot?.data) ? plot.data.length : 0),
    0
  )
  return {
    typeLabel: types.length > 0 ? types.join(' + ') : markTypeLabels.unknown,
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
      version: providerSettingsVersion,
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
  exportAPNGButton.disabled = !hasRenderedSpec || isExportingImage
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
    statusNode.textContent = '当前还没有可重新渲染的 JSON 规范。'
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
      ? `已根据当前 JSON 对象重新渲染 ${layoutLabel} 视图，包含 ${typeLabel} 图形。`
      : `已根据当前 JSON 对象重新渲染 ${typeLabel} 图表。`
    statusNode.className = 'status ok'
  } catch (error) {
    statusNode.textContent = error?.message || '重新渲染失败。'
    statusNode.className = 'status error'
  }
}

async function exportRenderedImage() {
  if (!lastRenderedSpec) {
    statusNode.textContent = '当前还没有可导出的 JSON 规范。'
    statusNode.className = 'status'
    return
  }

  isExportingImage = true
  syncChartActionButtons()
  statusNode.textContent = '正在导出 PNG 图片…'
  statusNode.className = 'status live'

  try {
    await exportSpecAsPNG(cloneSpec(lastRenderedSpec), {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      filename: createExportFilename('png')
    })

    statusNode.textContent = '已下载当前图表的 PNG 图片。'
    statusNode.className = 'status ok'
  } catch (error) {
    statusNode.textContent = error?.message || 'PNG 导出失败。'
    statusNode.className = 'status error'
  } finally {
    isExportingImage = false
    syncChartActionButtons()
  }
}

async function exportRenderedAPNG() {
  if (!lastRenderedSpec) {
    statusNode.textContent = '当前还没有可导出的 JSON 规范。'
    statusNode.className = 'status'
    return
  }

  isExportingImage = true
  syncChartActionButtons()
  statusNode.textContent = '正在导出 APNG 动图…'
  statusNode.className = 'status live'

  try {
    await exportSpecAsAPNG(cloneSpec(lastRenderedSpec), {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      filename: createExportFilename('apng')
    })

    statusNode.textContent = '已下载当前图表的 APNG 动图。'
    statusNode.className = 'status ok'
  } catch (error) {
    statusNode.textContent = error?.message || 'APNG 导出失败。'
    statusNode.className = 'status error'
  } finally {
    isExportingImage = false
    syncChartActionButtons()
  }
}

function createExportFilename(extension = 'png') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `sparrow-chart-${timestamp}.${extension}`
}

function createConfiguredProvider(systemPrompt) {
  const targetBaseURL = targetBaseURLInput.value.trim()
  const requestConfig = buildProviderRequestConfig({
    connectionMode: connectionModeSelect.value,
    proxyBaseURL: defaultProviderSettings.proxyBaseURL,
    targetBaseURL
  })
  const apiKey = apiKeyInput.value.trim()

  if (requestConfig.connectionMode === 'direct' && !requestConfig.baseURL) {
    throw new Error('直连模式下必须填写目标 Base URL。')
  }

  if (requestConfig.connectionMode === 'proxy' && targetBaseURL && !apiKey) {
    throw new Error('使用自定义代理目标时，必须同时填写 API Key。')
  }

  return createOpenAICompatibleProvider({
    baseURL: requestConfig.baseURL,
    headers: requestConfig.headers,
    apiKey,
    model: modelInput.value.trim() || defaultProviderSettings.model,
    systemPrompt
  })
}

function syncConnectionModeUI() {
  const isDirect = connectionModeSelect.value === 'direct'
  targetBaseURLInput.placeholder = isDirect
    ? 'https://open.bigmodel.cn/api/paas/v4 或其他兼容端点'
    : '留空则使用服务端已配置的智谱目标地址'
  connectionModeHint.textContent = isDirect
    ? '直连模式会由浏览器直接请求目标地址，因此目标接口必须允许 CORS；此时请使用你自己的 API Key。'
    : '代理模式会先请求 /api/openai。Target Base URL 和 API Key 都留空时，将使用服务端已配置的智谱设置。'
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
  const canRestoreProviderSettings = stored.version === providerSettingsVersion
  promptPresetSelect.value =
    typeof stored.promptPreset === 'string'
      ? getPlotSpecPromptPreset(stored.promptPreset).id
      : DEFAULT_PLOT_SPEC_PROMPT_PRESET
  providerSelect.value = 'openai-compatible'
  connectionModeSelect.value =
    canRestoreProviderSettings && stored.connectionMode === 'direct'
      ? 'direct'
      : defaultProviderSettings.connectionMode
  targetBaseURLInput.value =
    canRestoreProviderSettings && typeof stored.targetBaseURL === 'string'
      ? stored.targetBaseURL
      : defaultProviderSettings.targetBaseURL
  modelInput.value =
    canRestoreProviderSettings && stored.model
      ? stored.model
      : defaultProviderSettings.model
  animateRenderInput.checked = stored.animateRender === true
  autoLayoutInput.checked = stored.autoLayout !== false
  syncPromptPresetUI()
  syncConnectionModeUI()
}

populatePromptPresetOptions()
initializeProviderSettings()

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
exportAPNGButton.addEventListener('click', () => {
  void exportRenderedAPNG()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const prompt = promptInput.value.trim()
  if (!prompt) return

  controller?.abort()
  controller = new AbortController()

  const buffer = createPlotSpecChunkBuffer()
  const promptPreset = getPlotSpecPromptPreset(promptPresetSelect.value)
  let provider
  try {
    provider = createConfiguredProvider(promptPreset.systemPrompt)
  } catch (error) {
    statusNode.textContent = error?.message || 'Provider 配置失败。'
    statusNode.className = 'status error'
    return
  }
  persistProviderSettings()

  runButton.disabled = true
  stopButton.disabled = false
  clearRenderedSpec()
  statusNode.textContent = '正在流式接收模型输出…'
  statusNode.className = 'status live'
  summaryNode.textContent = '等待 JSON'
  streamLogNode.textContent = ''
  specJsonNode.textContent = ''
  previewNode.innerHTML =
    '<div class="preview-empty">正在流式接收并解析…</div>'

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
          ? `${layoutLabel} · ${typeLabel} · ${count} 条数据`
          : `${typeLabel} · ${count} 条数据`
      },
      onRender(result, spec) {
        lastRenderResult = result
        const effectiveSpec = getEffectiveSpec(spec)
        const { typeLabel, layoutLabel } = summarizeSpec(effectiveSpec)
        const animationSuffix = animateRenderInput.checked
          ? '，带入场动画'
          : ''
        statusNode.textContent = layoutLabel
          ? `已根据最近一个有效 JSON 对象渲染 ${layoutLabel}，包含 ${typeLabel}${animationSuffix}。`
          : `已根据最近一个有效 JSON 对象渲染 ${typeLabel}${animationSuffix}。`
        statusNode.className = 'status ok'
      }
    })

    const effectiveSpec = getEffectiveSpec(result.spec)
    const { typeLabel, layoutLabel } = summarizeSpec(effectiveSpec)
    const animationSuffix = animateRenderInput.checked
      ? '，并播放了入场动画'
      : ''
    statusNode.textContent = layoutLabel
      ? `完成。已解析并渲染 ${layoutLabel}，包含 ${typeLabel}${animationSuffix}。`
      : `完成。已解析并渲染 ${typeLabel}${animationSuffix}。`
    statusNode.className = 'status ok'
  } catch (error) {
    if (error?.name === 'AbortError') {
      statusNode.textContent = '已停止生成。'
      statusNode.className = 'status'
    } else {
      statusNode.textContent = error?.message || '生成失败。'
      statusNode.className = 'status error'
    }
  } finally {
    runButton.disabled = false
    stopButton.disabled = true
  }
})
