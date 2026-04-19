import {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  DEFAULT_PLAYGROUND_PROVIDER,
  applyPlaygroundAnimationPreference,
  buildProviderRequestConfig,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  getDefaultPlaygroundProviderSettings,
  getPlaygroundProviderProfile,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets,
  normalizePlaygroundProvider,
  renderAISpec,
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
const exportMenuButton = document.getElementById('export-menu-button')
const exportMenuRoot = document.getElementById('export-dropdown')
const exportMenuPanel =
  document.getElementById('export-menu-panel') ||
  exportMenuRoot?.querySelector('.dropdown-menu') ||
  null
const exportImageButton = document.getElementById('export-image')
const exportAPNGButton = document.getElementById('export-apng')
const legacyStatusNode = document.getElementById('status')
const statusTextNode =
  document.getElementById('status-text') || legacyStatusNode
const statusDotNode = document.getElementById('status-dot')
const summaryNode = document.getElementById('summary')
const streamLogNode = document.getElementById('stream-log')
const specJsonNode = document.getElementById('spec-json')
const previewNode = document.getElementById('preview')
const env = import.meta.env || {}
const providerSettingsKey = 'sparrow.playground.provider-settings'
const providerSettingsVersion = 3
const defaultProviderSettingsById = Object.freeze({
  zhipu: getDefaultPlaygroundProviderSettings(env, 'zhipu'),
  openai: getDefaultPlaygroundProviderSettings(env, 'openai')
})

const hasPlaygroundPage = Boolean(
  form &&
    promptInput &&
    canvasWidthInput &&
    canvasHeightInput &&
    promptPresetSelect &&
    providerSelect &&
    connectionModeSelect &&
    targetBaseURLInput &&
    modelInput &&
    apiKeyInput &&
    animateRenderInput &&
    autoLayoutInput &&
    runButton &&
    stopButton &&
    rerenderButton &&
    exportMenuButton &&
    exportImageButton &&
    exportAPNGButton &&
    statusTextNode &&
    summaryNode &&
    streamLogNode &&
    specJsonNode &&
    previewNode
)

let controller = null
let lastRenderedSpec = null
let lastRenderResult = null
let lastRenderedDimensions = null
let isExportingImage = false
let activeProvider = DEFAULT_PLAYGROUND_PROVIDER

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

const statusStyles = Object.freeze({
  idle: {
    text: 'var(--muted)',
    dot: 'var(--muted)',
    shadow: 'none'
  },
  live: {
    text: 'var(--text-secondary)',
    dot: 'var(--accent)',
    shadow: '0 0 0 3px var(--accent-dim)'
  },
  ok: {
    text: 'var(--success)',
    dot: 'var(--success)',
    shadow: 'none'
  },
  error: {
    text: 'var(--danger)',
    dot: 'var(--danger)',
    shadow: 'none'
  }
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
  const stored = getProviderSettingsMap()
  localStorage.setItem(
    providerSettingsKey,
    JSON.stringify({
      version: providerSettingsVersion,
      provider: activeProvider,
      promptPreset: promptPresetSelect.value,
      animateRender: animateRenderInput.checked,
      autoLayout: autoLayoutInput.checked,
      providers: {
        ...stored.providers,
        [activeProvider]: {
          connectionMode: connectionModeSelect.value,
          targetBaseURL: targetBaseURLInput.value.trim(),
          model: modelInput.value.trim()
        }
      }
    })
  )
}

function getProviderSettingsMap() {
  const stored = readStoredProviderSettings()
  const canRestoreScopedProviders =
    stored.version === providerSettingsVersion &&
    stored.providers &&
    typeof stored.providers === 'object'
  const legacyZhipuSettings =
    stored.version === 2
      ? {
          connectionMode: stored.connectionMode,
          targetBaseURL: stored.targetBaseURL,
          model: stored.model
        }
      : {}

  return {
    provider: canRestoreScopedProviders
      ? normalizePlaygroundProvider(stored.provider)
      : DEFAULT_PLAYGROUND_PROVIDER,
    promptPreset:
      typeof stored.promptPreset === 'string'
        ? getPlotSpecPromptPreset(stored.promptPreset).id
        : DEFAULT_PLOT_SPEC_PROMPT_PRESET,
    animateRender: stored.animateRender === true,
    autoLayout: stored.autoLayout !== false,
    providers: {
      zhipu: {
        connectionMode:
          (canRestoreScopedProviders
            ? stored.providers?.zhipu?.connectionMode
            : legacyZhipuSettings.connectionMode) === 'direct'
            ? 'direct'
            : defaultProviderSettingsById.zhipu.connectionMode,
        targetBaseURL:
          typeof (canRestoreScopedProviders
            ? stored.providers?.zhipu?.targetBaseURL
            : legacyZhipuSettings.targetBaseURL) === 'string'
            ? (
                canRestoreScopedProviders
                  ? stored.providers?.zhipu?.targetBaseURL
                  : legacyZhipuSettings.targetBaseURL
              ).trim()
            : defaultProviderSettingsById.zhipu.targetBaseURL,
        model:
          String(
            canRestoreScopedProviders
              ? stored.providers?.zhipu?.model
              : legacyZhipuSettings.model || ''
          ).trim() || defaultProviderSettingsById.zhipu.model
      },
      openai: {
        connectionMode:
          stored.providers?.openai?.connectionMode === 'direct'
            ? 'direct'
            : defaultProviderSettingsById.openai.connectionMode,
        targetBaseURL:
          typeof stored.providers?.openai?.targetBaseURL === 'string'
            ? stored.providers.openai.targetBaseURL.trim()
            : defaultProviderSettingsById.openai.targetBaseURL,
        model:
          String(stored.providers?.openai?.model || '').trim() ||
          defaultProviderSettingsById.openai.model
      }
    }
  }
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

function setStatus(message, tone = 'idle') {
  const style = statusStyles[tone] || statusStyles.idle

  if (statusTextNode) {
    statusTextNode.textContent = message
    if (statusTextNode !== legacyStatusNode) {
      statusTextNode.style.color = style.text
    }
  }

  if (legacyStatusNode) {
    legacyStatusNode.className = tone === 'idle' ? 'status' : `status ${tone}`
  }

  if (statusDotNode) {
    statusDotNode.classList.toggle('active', tone === 'live')
    statusDotNode.style.background = style.dot
    statusDotNode.style.boxShadow = style.shadow
  }
}

function setSummary(text, visible = Boolean(text)) {
  summaryNode.textContent = text
  summaryNode.hidden = !visible
}

function setPreviewPlaceholder(text) {
  previewNode.innerHTML = `<div class="empty-state"><div>${text}</div></div>`
}

function isExportMenuOpen() {
  if (exportMenuRoot) {
    return exportMenuRoot.classList.contains('open')
  }
  return exportMenuPanel?.hidden === false
}

function syncChartActionButtons() {
  const hasRenderedSpec = Boolean(lastRenderedSpec)
  const exportDisabled = !hasRenderedSpec || isExportingImage

  rerenderButton.disabled = !hasRenderedSpec
  exportMenuButton.disabled = exportDisabled
  exportImageButton.disabled = exportDisabled
  exportAPNGButton.disabled = exportDisabled

  if (!hasRenderedSpec) {
    setSummary('暂无图表规范', false)
  }

  if (exportDisabled) {
    closeExportMenu()
  }
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
  setSummary('暂无图表规范', false)
  syncChartActionButtons()
}

function renderStoredSpec() {
  if (!lastRenderedSpec) {
    setStatus('当前还没有可重新渲染的 JSON 规范。')
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
    setStatus(
      layoutLabel
        ? `已根据当前 JSON 对象重新渲染 ${layoutLabel}，包含 ${typeLabel}。`
        : `已根据当前 JSON 对象重新渲染 ${typeLabel}。`,
      'ok'
    )
  } catch (error) {
    setStatus(error?.message || '重新渲染失败。', 'error')
  }
}

async function exportRenderedImage() {
  if (!lastRenderedSpec) {
    setStatus('当前还没有可导出的 JSON 规范。')
    return
  }

  isExportingImage = true
  syncChartActionButtons()
  setStatus('正在导出 PNG 图片…', 'live')

  try {
    await exportSpecAsPNG(cloneSpec(lastRenderedSpec), {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      filename: createExportFilename('png')
    })
    setStatus('已下载当前图表的 PNG 图片。', 'ok')
  } catch (error) {
    setStatus(error?.message || 'PNG 导出失败。', 'error')
  } finally {
    isExportingImage = false
    syncChartActionButtons()
  }
}

async function exportRenderedAPNG() {
  if (!lastRenderedSpec) {
    setStatus('当前还没有可导出的 JSON 规范。')
    return
  }

  isExportingImage = true
  syncChartActionButtons()
  setStatus('正在导出 APNG 动图…', 'live')

  try {
    await exportSpecAsAPNG(cloneSpec(lastRenderedSpec), {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      filename: createExportFilename('apng')
    })
    setStatus('已下载当前图表的 APNG 动图。', 'ok')
  } catch (error) {
    setStatus(error?.message || 'APNG 导出失败。', 'error')
  } finally {
    isExportingImage = false
    syncChartActionButtons()
  }
}

function createExportFilename(extension = 'png') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `sparrow-chart-${timestamp}.${extension}`
}

function setExportMenuOpen(open) {
  const isOpen = Boolean(open) && !exportMenuButton.disabled

  exportMenuRoot?.classList.toggle('open', isOpen)
  if (exportMenuPanel) {
    exportMenuPanel.hidden = !isOpen
  }
  exportMenuButton.setAttribute('aria-expanded', String(isOpen))
}

function closeExportMenu() {
  setExportMenuOpen(false)
}

function toggleExportMenu() {
  setExportMenuOpen(!isExportMenuOpen())
}

function createConfiguredProvider(systemPrompt) {
  const providerDefaults = defaultProviderSettingsById[activeProvider]
  const targetBaseURL =
    targetBaseURLInput.value.trim() || providerDefaults.targetBaseURL
  const requestConfig = buildProviderRequestConfig({
    connectionMode: connectionModeSelect.value,
    proxyBaseURL: providerDefaults.proxyBaseURL,
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
    model: modelInput.value.trim() || providerDefaults.model,
    systemPrompt
  })
}

function syncConnectionModeUI() {
  const providerProfile = getPlaygroundProviderProfile(activeProvider, env)
  const isDirect = connectionModeSelect.value === 'direct'
  const hint = isDirect
    ? providerProfile.directHint
    : providerProfile.proxyHint

  targetBaseURLInput.placeholder = isDirect
    ? providerProfile.directTargetPlaceholder
    : providerProfile.proxyTargetPlaceholder

  if (connectionModeHint) {
    connectionModeHint.textContent = hint
  }

  connectionModeSelect.title = hint
  targetBaseURLInput.title = hint
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
  if (promptPresetHint) {
    promptPresetHint.textContent = preset.description
  }
  promptPresetSelect.title = preset.description
}

function initializeProviderSettings() {
  const stored = getProviderSettingsMap()
  promptPresetSelect.value = stored.promptPreset
  activeProvider = normalizePlaygroundProvider(stored.provider)
  providerSelect.value = activeProvider
  connectionModeSelect.value = stored.providers[activeProvider].connectionMode
  targetBaseURLInput.value = stored.providers[activeProvider].targetBaseURL
  modelInput.value = stored.providers[activeProvider].model
  animateRenderInput.checked = stored.animateRender
  autoLayoutInput.checked = stored.autoLayout
  syncPromptPresetUI()
  syncConnectionModeUI()
}

if (hasPlaygroundPage) {
  populatePromptPresetOptions()
  initializeProviderSettings()
  syncChartActionButtons()
  closeExportMenu()
  setStatus(statusTextNode.textContent || '等待输入提示词')

  promptPresetSelect.addEventListener('change', () => {
    syncPromptPresetUI()
    persistProviderSettings()
  })

  providerSelect.addEventListener('change', () => {
    persistProviderSettings()
    const stored = getProviderSettingsMap()
    activeProvider = normalizePlaygroundProvider(providerSelect.value)
    connectionModeSelect.value = stored.providers[activeProvider].connectionMode
    targetBaseURLInput.value = stored.providers[activeProvider].targetBaseURL
    modelInput.value = stored.providers[activeProvider].model
    syncConnectionModeUI()
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
  exportMenuButton.addEventListener('click', (event) => {
    event.stopPropagation()
    toggleExportMenu()
  })
  exportImageButton.addEventListener('click', () => {
    closeExportMenu()
    void exportRenderedImage()
  })
  exportAPNGButton.addEventListener('click', () => {
    closeExportMenu()
    void exportRenderedAPNG()
  })

  document.addEventListener('click', (event) => {
    if (!isExportMenuOpen()) return
    if (exportMenuPanel?.contains(event.target)) return
    if (exportMenuButton.contains(event.target)) return
    closeExportMenu()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeExportMenu()
    }
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
      setStatus(error?.message || 'Provider 配置失败。', 'error')
      return
    }

    persistProviderSettings()

    runButton.disabled = true
    stopButton.disabled = false
    clearRenderedSpec()
    setStatus('正在流式接收模型输出…', 'live')
    setSummary('等待 JSON', true)
    streamLogNode.textContent = ''
    specJsonNode.textContent = ''
    setPreviewPlaceholder('正在流式接收并解析…')

    try {
      const canvasWidth = parseInt(canvasWidthInput.value) || 640
      const canvasHeight = parseInt(canvasHeightInput.value) || 480

      previewNode.style.width = `${canvasWidth}px`
      previewNode.style.height = `${canvasHeight}px`
      previewNode.style.margin = '0 auto'

      const promptWithSize = `画布尺寸: ${canvasWidth}x${canvasHeight}。${prompt}`

      const result = await streamPlotSpec({
        prompt: promptWithSize,
        provider,
        buffer,
        signal: controller.signal,
        render(spec, renderOptions) {
          const effectiveSpec = getEffectiveSpec(spec)
          return renderAISpec(
            {
              ...effectiveSpec,
              width: canvasWidth,
              height: canvasHeight
            },
            {
              ...renderOptions,
              ...getRenderPreferences(),
              width: canvasWidth,
              height: canvasHeight
            }
          )
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
          setSummary(
            layoutLabel
              ? `${layoutLabel} / ${typeLabel} / ${count} 条数据`
              : `${typeLabel} / ${count} 条数据`,
            true
          )
        },
        onRender(result, spec) {
          lastRenderResult = result
          const effectiveSpec = getEffectiveSpec(spec)
          const { typeLabel, layoutLabel } = summarizeSpec(effectiveSpec)
          const animationSuffix = animateRenderInput.checked ? '，带入场动画' : ''

          setStatus(
            layoutLabel
              ? `已根据最近一个有效 JSON 对象渲染 ${layoutLabel}，包含 ${typeLabel}${animationSuffix}。`
              : `已根据最近一个有效 JSON 对象渲染 ${typeLabel}${animationSuffix}。`,
            'ok'
          )
        }
      })

      const effectiveSpec = getEffectiveSpec(result.spec)
      const { typeLabel, layoutLabel } = summarizeSpec(effectiveSpec)
      const animationSuffix = animateRenderInput.checked
        ? '，并播放了入场动画'
        : ''

      setStatus(
        layoutLabel
          ? `完成。已解析并渲染 ${layoutLabel}，包含 ${typeLabel}${animationSuffix}。`
          : `完成。已解析并渲染 ${typeLabel}${animationSuffix}。`,
        'ok'
      )
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('已停止生成。')
      } else {
        setStatus(error?.message || '生成失败。', 'error')
      }
    } finally {
      runButton.disabled = false
      stopButton.disabled = true
    }
  })
}
