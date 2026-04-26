import {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  DEFAULT_PLAYGROUND_PROVIDER,
  applyPlaygroundAnimationPreference,
  buildProviderRequestConfig,
  createOpenAICompatibleProvider,
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
const autoLayoutActionButton = document.getElementById('auto-layout-action')
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
const pageShell = document.getElementById('page-shell')
const helpTriggerButton = document.getElementById('help-trigger')
const helpSidebar = document.getElementById('help-sidebar')
const helpCloseButton = document.getElementById('help-close')
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
let streamSlotRenderer = null
let lastStreamSlotState = null
let activeProvider = DEFAULT_PLAYGROUND_PROVIDER
let lastFocusedNodeBeforeHelp = null

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

const autoLayoutMarkTypes = new Set([
  'point',
  'line',
  'interval',
  'pie',
  'area',
  'rect',
  'cell',
  'text'
])


const ndjsonStreamPromptSuffix = [
  'Output NDJSON only: one valid JSON object per line, no markdown fences and no prose.',
  'For multi-panel requests, first emit {"type":"layout","width": number, "height": number, "layout":{"type":"absolute","slots":[{"id":"slot-id","x":0,"y":0,"width":320,"height":240}]}}.',
  'Then emit one {"type":"chart","id":"slot-id","spec": SparrowPlotSpecLeafOrViewChild } line per panel as soon as it is ready; each chart is rendered only inside its slot rectangle.',
  'For a single chart, emit one chart line with id "main".',
  'Finish with {"type":"done"}.',
  'Each chart spec must be independently renderable as {"plot": {...}}, {"plots": [...]}, or a valid view child.'
].join(' ')

function withNDJSONStreamInstructions(systemPrompt) {
  return `${systemPrompt}

${ndjsonStreamPromptSuffix}`
}

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

function hasAutoLayoutCandidate(spec) {
  const root = spec?.view || spec
  return hasAutoLayoutCandidateNode(root)
}

function hasAutoLayoutCandidateNode(node) {
  if (!node || typeof node !== 'object') return false

  if (
    Array.isArray(node.children) &&
    (node.type === 'row' || node.type === 'col') &&
    node.flex === undefined &&
    node.autoLayout !== false &&
    node?.layout?.auto !== false
  ) {
    if (
      node.children.length >= 4 &&
      node.children.every((child) => isAutoLayoutPlotLikeSpec(child))
    ) {
      return true
    }

    const innerType = node.type === 'col' ? 'row' : 'col'
    if (
      node.children.length >= 2 &&
      node.children.every((child) =>
        isAutoLayoutGridAxisGroup(child, innerType)
      )
    ) {
      return true
    }
  }

  if (node.view) {
    return hasAutoLayoutCandidateNode(node.view)
  }

  if (Array.isArray(node.children)) {
    return node.children.some((child) => hasAutoLayoutCandidateNode(child))
  }

  return false
}

function isAutoLayoutGridAxisGroup(node, type) {
  return Boolean(
    node &&
    node.type === type &&
    node.flex === undefined &&
    Array.isArray(node.children) &&
    node.children.length > 0 &&
    node.children.every((child) => isAutoLayoutPlotLikeSpec(child))
  )
}

function isAutoLayoutPlotLikeSpec(node) {
  return Boolean(
    node &&
    typeof node === 'object' &&
    !Array.isArray(node) &&
    (Array.isArray(node.plots) ||
      Array.isArray(node.plot) ||
      node.plot ||
      autoLayoutMarkTypes.has(node.type))
  )
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
            ? (canRestoreScopedProviders
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

function getRenderPreferences(overrides = {}) {
  return {
    autoLayout: autoLayoutInput.checked,
    ...overrides
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

function createStreamSlotRenderer({ width, height, renderPreferences }) {
  const root = document.createElement('div')
  root.className = 'stream-slot-preview'
  root.style.position = 'relative'
  root.style.width = `${width}px`
  root.style.height = `${height}px`
  root.style.overflow = 'hidden'

  const slotMap = new Map()
  const pendingCharts = new Map()
  let layout = null

  previewNode.replaceChildren(root)

  function applyLayout(nextLayout) {
    layout = nextLayout
    root.replaceChildren()
    slotMap.clear()

    const frames = getStreamSlotFrames(nextLayout, width, height)
    frames.forEach((slot) => {
      const node = document.createElement('div')
      node.className = 'stream-slot-preview__slot'
      node.dataset.slot = slot.id
      node.style.position = 'absolute'
      node.style.left = `${slot.x}px`
      node.style.top = `${slot.y}px`
      node.style.width = `${slot.width}px`
      node.style.height = `${slot.height}px`
      node.style.overflow = 'hidden'
      root.appendChild(node)
      slotMap.set(slot.id, { slot, node, result: null })
    })

    for (const [id, event] of pendingCharts) {
      renderChart(event)
      pendingCharts.delete(id)
    }
  }

  function renderChart(event) {
    if (!event?.spec) return null
    const id = String(event.id || event.slot || event.key || 'main')
    const entry = slotMap.get(id) || ensureFallbackSlot(id)
    if (!entry) {
      pendingCharts.set(id, event)
      return null
    }

    entry.result?.stopAnimations?.()
    const scopedSpec = {
      ...event.spec,
      width: entry.slot.width,
      height: entry.slot.height
    }
    entry.result = renderAISpec(scopedSpec, {
      container: entry.node,
      ...renderPreferences,
      width: entry.slot.width,
      height: entry.slot.height
    })
    return entry.result
  }

  function ensureFallbackSlot(id) {
    if (slotMap.size > 0) return null
    applyLayout({ slots: [{ id, x: 0, y: 0, width, height }] })
    return slotMap.get(id)
  }

  function stop() {
    slotMap.forEach((entry) => entry.result?.stopAnimations?.())
  }

  return { applyLayout, renderChart, stop, getLayout: () => layout }
}

function getStreamSlotFrames(layout, width, height) {
  const frames = Array.isArray(layout?.slotFrames)
    ? layout.slotFrames
    : Array.isArray(layout?.slots)
      ? layout.slots.map((slot) =>
          typeof slot === 'object' ? slot : { id: String(slot) }
        )
      : []

  if (frames.length === 0) {
    return [{ id: 'main', x: 0, y: 0, width, height }]
  }

  const needsGrid = frames.some(
    (slot) =>
      !Number.isFinite(slot.x) ||
      !Number.isFinite(slot.y) ||
      !Number.isFinite(slot.width) ||
      !Number.isFinite(slot.height)
  )
  if (!needsGrid) return frames.map((slot) => normalizeSlotFrame(slot, width, height))

  const columns = Math.ceil(Math.sqrt(frames.length))
  const rows = Math.ceil(frames.length / columns)
  const cellWidth = width / columns
  const cellHeight = height / rows

  return frames.map((slot, index) =>
    normalizeSlotFrame(
      {
        ...slot,
        x: (index % columns) * cellWidth,
        y: Math.floor(index / columns) * cellHeight,
        width: cellWidth,
        height: cellHeight
      },
      width,
      height
    )
  )
}

function normalizeSlotFrame(slot, fallbackWidth, fallbackHeight) {
  return {
    id: String(slot.id || slot.slot || slot.key || 'main'),
    x: Number.isFinite(slot.x) ? slot.x : 0,
    y: Number.isFinite(slot.y) ? slot.y : 0,
    width: Number.isFinite(slot.width) ? slot.width : fallbackWidth,
    height: Number.isFinite(slot.height) ? slot.height : fallbackHeight
  }
}

function isExportMenuOpen() {
  if (exportMenuRoot) {
    return exportMenuRoot.classList.contains('open')
  }
  return exportMenuPanel?.hidden === false
}

function syncChartActionButtons() {
  const hasRenderedSpec = Boolean(lastRenderedSpec)
  const autoLayoutDisabled =
    !hasRenderedSpec || !hasAutoLayoutCandidate(lastRenderedSpec)
  const exportDisabled = !hasRenderedSpec || isExportingImage

  if (autoLayoutActionButton) {
    autoLayoutActionButton.disabled = autoLayoutDisabled
  }
  rerenderButton.disabled = !hasRenderedSpec
  exportMenuButton.disabled = exportDisabled
  exportImageButton.disabled = exportDisabled
  exportAPNGButton.disabled = exportDisabled

  if (autoLayoutActionButton) {
    autoLayoutActionButton.title = autoLayoutDisabled
      ? hasRenderedSpec
        ? '\u5f53\u524d\u56fe\u8868\u6ca1\u6709\u53ef\u91cd\u65b0\u8ba1\u7b97\u7684\u591a\u56fe\u5e03\u5c40'
        : '\u751f\u6210\u56fe\u8868\u540e\u53ef\u81ea\u52a8\u6392\u7248'
      : '\u6839\u636e\u753b\u5e03\u91cd\u65b0\u8ba1\u7b97\u591a\u56fe\u4f4d\u7f6e'
  }

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

function rememberStreamSlotLayout(layout, dimensions, renderPreferences) {
  lastStreamSlotState = {
    layout: cloneSpec(layout),
    charts: new Map(),
    dimensions: dimensions ? { ...dimensions } : null,
    renderPreferences: { ...renderPreferences }
  }
}

function rememberStreamSlotChart(event) {
  if (!lastStreamSlotState || !event?.spec) return
  const id = String(event.id || event.slot || event.key || 'main')
  lastStreamSlotState.charts.set(id, {
    ...event,
    id,
    spec: cloneSpec(event.spec)
  })
}

function clearRenderedSpec() {
  lastRenderedSpec = null
  lastRenderResult = null
  streamSlotRenderer?.stop?.()
  streamSlotRenderer = null
  lastStreamSlotState = null
  lastRenderedDimensions = null
  isExportingImage = false
  setSummary('暂无图表规范', false)
  syncChartActionButtons()
}

function renderStoredSpec(options = {}) {
  if (!lastRenderedSpec) {
    setStatus('当前还没有可重新渲染的 JSON 规范。')
    return
  }

  try {
    const renderPreferences = getRenderPreferences(options.renderPreferences)
    lastRenderResult?.stopAnimations?.()
    if (lastStreamSlotState) {
      renderStoredStreamSlots(renderPreferences)
    } else {
      lastRenderResult = renderAISpec(getEffectiveSpec(cloneSpec(lastRenderedSpec)), {
        container: previewNode,
        ...renderPreferences,
        ...(lastRenderedDimensions || {})
      })
    }

    if (options.successMessage) {
      setStatus(options.successMessage, 'ok')
      return
    }

    const { typeLabel, layoutLabel } = summarizeSpec(lastRenderedSpec)
    const autoLayoutSuffix =
      renderPreferences.autoLayout && hasAutoLayoutCandidate(lastRenderedSpec)
        ? '，并重新计算了多图位置'
        : ''
    setStatus(
      layoutLabel
        ? `已根据当前 JSON 对象重新渲染 ${layoutLabel}，包含 ${typeLabel}${autoLayoutSuffix}。`
        : `已根据当前 JSON 对象重新渲染 ${typeLabel}${autoLayoutSuffix}。`,
      'ok'
    )
  } catch (error) {
    setStatus(error?.message || '重新渲染失败。', 'error')
  }
}

function renderStoredStreamSlots(renderPreferences) {
  const dimensions =
    lastStreamSlotState.dimensions || lastRenderedDimensions || {
      width: parseInt(canvasWidthInput.value) || 640,
      height: parseInt(canvasHeightInput.value) || 480
    }

  streamSlotRenderer?.stop?.()
  streamSlotRenderer = createStreamSlotRenderer({
    width: dimensions.width,
    height: dimensions.height,
    renderPreferences
  })
  streamSlotRenderer.applyLayout(lastStreamSlotState.layout)

  for (const event of lastStreamSlotState.charts.values()) {
    streamSlotRenderer.renderChart({
      ...event,
      spec: getEffectiveSpec(cloneSpec(event.spec))
    })
  }

  lastRenderResult = {
    node: previewNode,
    spec: lastRenderedSpec,
    stopAnimations: () => streamSlotRenderer?.stop?.()
  }
}

function autoLayoutStoredSpec() {
  if (!lastRenderedSpec) {
    setStatus('当前还没有可自动排版的 JSON 规范。')
    return
  }

  if (!hasAutoLayoutCandidate(lastRenderedSpec)) {
    setStatus('当前图表不包含需要重新计算位置的多图布局。')
    return
  }

  if (!autoLayoutInput.checked) {
    autoLayoutInput.checked = true
    persistProviderSettings()
  }

  renderStoredSpec({
    renderPreferences: {
      autoLayout: true
    },
    successMessage: '已根据画布大小重新计算多图位置并自动排版。'
  })
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

function isHelpModalOpen() {
  return pageShell?.classList.contains('help-open') === true
}

function openHelpModal() {
  if (!pageShell || !helpSidebar) return
  lastFocusedNodeBeforeHelp = document.activeElement
  pageShell.classList.add('help-open')
  helpSidebar.setAttribute('aria-hidden', 'false')
  helpTriggerButton?.setAttribute('aria-expanded', 'true')
  helpCloseButton?.focus()
}

function closeHelpModal() {
  if (!pageShell || !helpSidebar) return
  pageShell.classList.remove('help-open')
  helpSidebar.setAttribute('aria-hidden', 'true')
  helpTriggerButton?.setAttribute('aria-expanded', 'false')
  lastFocusedNodeBeforeHelp?.focus?.()
}

function toggleHelpModal() {
  if (isHelpModalOpen()) {
    closeHelpModal()
    return
  }
  openHelpModal()
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
  const hint = isDirect ? providerProfile.directHint : providerProfile.proxyHint

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

  autoLayoutActionButton?.addEventListener('click', autoLayoutStoredSpec)
  rerenderButton.addEventListener('click', renderStoredSpec)
  helpTriggerButton?.addEventListener('click', toggleHelpModal)
  helpCloseButton?.addEventListener('click', closeHelpModal)
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
      if (isHelpModalOpen()) {
        closeHelpModal()
        return
      }
      closeExportMenu()
    }
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    const prompt = promptInput.value.trim()
    if (!prompt) return

    controller?.abort()
    controller = new AbortController()

    const promptPreset = getPlotSpecPromptPreset(promptPresetSelect.value)
    let provider

    try {
      provider = createConfiguredProvider(
        withNDJSONStreamInstructions(promptPreset.systemPrompt)
      )
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
      const renderPreferences = getRenderPreferences()

      previewNode.style.width = `${canvasWidth}px`
      previewNode.style.height = `${canvasHeight}px`
      previewNode.style.margin = '0 auto'
      streamSlotRenderer = createStreamSlotRenderer({
        width: canvasWidth,
        height: canvasHeight,
        renderPreferences
      })

      const promptWithSize = `Canvas size: ${canvasWidth}x${canvasHeight}. Put id, x, y, width, and height in layout.slots for each chart. ${prompt}`

      const result = await streamPlotSpec({
        prompt: promptWithSize,
        provider,
        streamFormat: 'ndjson',
        signal: controller.signal,
        render(spec, renderOptions) {
          if (streamSlotRenderer?.getLayout?.()) {
            return { node: previewNode, spec }
          }

          const effectiveSpec = getEffectiveSpec(spec)
          return renderAISpec(
            {
              ...effectiveSpec,
              width: canvasWidth,
              height: canvasHeight
            },
            {
              ...renderOptions,
              ...renderPreferences,
              width: canvasWidth,
              height: canvasHeight
            }
          )
        },
        renderOptions: {
          container: previewNode,
          ...renderPreferences,
          width: canvasWidth,
          height: canvasHeight
        },
        onChunk(chunk, text) {
          streamLogNode.textContent = text
        },
        onLayout(event, snapshot) {
          const layout = snapshot.layout || event.layout || event
          streamSlotRenderer?.applyLayout(layout)
          rememberStreamSlotLayout(
            layout,
            { width: canvasWidth, height: canvasHeight },
            renderPreferences
          )
          setStatus('Layout received; waiting for chart chunks...', 'live')
        },
        onChart(event, snapshot) {
          rememberStreamSlotChart(event)
          const partialResult = streamSlotRenderer?.renderChart({
            ...event,
            spec: getEffectiveSpec(event.spec)
          })
          if (partialResult) {
            lastRenderResult = {
              node: previewNode,
              spec: snapshot.spec,
              stopAnimations: () => streamSlotRenderer?.stop?.()
            }
          }
          setStatus(
            `Received ${snapshot.charts.length} chart chunk(s); rendering incrementally...`,
            'live'
          )
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
          const animationSuffix = animateRenderInput.checked
            ? '，带入场动画'
            : ''

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
