import {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  DEFAULT_PLAYGROUND_PROVIDER,
  applyPlaygroundAnimationPreference,
  buildProviderRequestConfig,
  createOpenAICompatibleProvider,
  createRAGPlotProvider,
  getDefaultPlaygroundProviderSettings,
  getPlaygroundProviderProfile,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets,
  normalizePlaygroundProvider,
  renderAISpec,
  retrieveVectorSparrowSyntaxKnowledge,
  streamPlotSpec,
  validateSparrowSpec
} from './plot/index.js'
import { exportSpecAsAPNG, exportSpecAsPNG } from './playground/exportImage.js'
import {
  createSpreadsheetPromptContext,
  formatSpreadsheetSummary,
  importSpreadsheetFile
} from './playground/importSpreadsheet.js'

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
const ragKnowledgeInput = document.getElementById('ragKnowledge')
const promptDropZone = document.querySelector('[data-spreadsheet-drop-zone]')
const spreadsheetStatusNode = document.getElementById('spreadsheet-status')
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
let importedSpreadsheet = null
let spreadsheetDragDepth = 0

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
      ragKnowledge: ragKnowledgeInput?.checked !== false,
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
    ragKnowledge: stored.ragKnowledge !== false,
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

function hasImportedSpreadsheetData() {
  return (
    Array.isArray(importedSpreadsheet?.rows) &&
    importedSpreadsheet.rows.length > 0
  )
}

function bindImportedSpreadsheetData(spec) {
  if (!hasImportedSpreadsheetData()) return spec
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec

  return bindSpreadsheetDataToNode(cloneSpec(spec), importedSpreadsheet.rows, {
    root: true
  })
}

function bindSpreadsheetDataToNode(node, rows, options = {}) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node

  const next = { ...node }
  if (options.root) next.data = rows

  if (Array.isArray(next.plots)) {
    next.plots = next.plots.map((plot) => bindSpreadsheetDataToMark(plot, rows))
  }

  if (Array.isArray(next.plot)) {
    next.plot = next.plot.map((plot) => bindSpreadsheetDataToMark(plot, rows))
  } else if (next.plot && typeof next.plot === 'object') {
    next.plot = bindSpreadsheetDataToMark(next.plot, rows)
  }

  if (next.view && typeof next.view === 'object') {
    next.view = bindSpreadsheetDataToNode(next.view, rows, { root: true })
  }

  if (
    Array.isArray(next.children) &&
    ['row', 'col', 'layer', 'facet'].includes(next.type)
  ) {
    next.data = rows
    next.children = next.children.map((child) =>
      bindSpreadsheetDataToNode(child, rows)
    )
  }

  if (autoLayoutMarkTypes.has(next.type)) {
    next.data = rows
  }

  return next
}

function bindSpreadsheetDataToMark(mark, rows) {
  if (!mark || typeof mark !== 'object' || Array.isArray(mark)) return mark
  return { ...mark, data: rows }
}

function getSpecValidator() {
  if (!hasImportedSpreadsheetData()) return true

  return (spec, options) =>
    validateSparrowSpec(bindImportedSpreadsheetData(spec), options)
}

function getSpreadsheetPromptContext() {
  return hasImportedSpreadsheetData()
    ? createSpreadsheetPromptContext(importedSpreadsheet)
    : ''
}

function appendSpreadsheetPromptContext(prompt) {
  const context = getSpreadsheetPromptContext()
  if (!context) return prompt
  return `${prompt}\n\nImported data context:\n${context}`
}

function syncSpreadsheetImportUI() {
  if (spreadsheetStatusNode) {
    spreadsheetStatusNode.textContent = importedSpreadsheet
      ? formatSpreadsheetSummary(importedSpreadsheet)
      : '可将 .xlsx、.xls 或 .csv 拖到提示词框，生成时会使用表格数据。'
    spreadsheetStatusNode.classList.toggle(
      'has-data',
      hasImportedSpreadsheetData()
    )
  }
}

function setSpreadsheetDropHint(active, overDropZone = false) {
  promptDropZone?.classList.toggle('is-drop-suggested', active)
  promptDropZone?.classList.toggle('is-drop-active', active && overDropZone)

  if (!spreadsheetStatusNode) return
  if (!active) {
    syncSpreadsheetImportUI()
    return
  }

  spreadsheetStatusNode.textContent = overDropZone
    ? '松开鼠标即可导入这个表格文件。'
    : '把 Excel / CSV 文件拖到提示词输入框导入。'
}

function isFileDragEvent(event) {
  const transfer = event?.dataTransfer
  if (!transfer) return false

  const types = Array.from(transfer.types || [])
  if (types.includes('Files')) return true

  return Array.from(transfer.items || []).some((item) => item.kind === 'file')
}

function isSpreadsheetDropTarget(target) {
  return Boolean(
    promptDropZone && target instanceof Node && promptDropZone.contains(target)
  )
}

function getSpreadsheetDropFile(transfer) {
  const files = Array.from(transfer?.files || [])
  if (files.length > 0) return files[0]

  const item = Array.from(transfer?.items || []).find(
    (entry) => entry.kind === 'file'
  )
  return item?.getAsFile?.() || null
}

function handleSpreadsheetDragEnter(event) {
  if (!isFileDragEvent(event)) return
  spreadsheetDragDepth += 1
  setSpreadsheetDropHint(true, isSpreadsheetDropTarget(event.target))
}

function handleSpreadsheetDragOver(event) {
  if (!isFileDragEvent(event)) return

  event.preventDefault()
  const overDropZone = isSpreadsheetDropTarget(event.target)
  event.dataTransfer.dropEffect = overDropZone ? 'copy' : 'none'
  setSpreadsheetDropHint(true, overDropZone)
}

function handleSpreadsheetDragLeave(event) {
  if (!isFileDragEvent(event)) return

  spreadsheetDragDepth = Math.max(0, spreadsheetDragDepth - 1)
  if (spreadsheetDragDepth === 0) {
    setSpreadsheetDropHint(false)
  }
}

function handleSpreadsheetDrop(event) {
  if (!isFileDragEvent(event)) return

  event.preventDefault()
  spreadsheetDragDepth = 0
  const overDropZone = isSpreadsheetDropTarget(event.target)
  const file = getSpreadsheetDropFile(event.dataTransfer)
  setSpreadsheetDropHint(false)

  if (!overDropZone) {
    setStatus('请将表格文件拖到提示词输入框。')
    return
  }

  void handleSpreadsheetImport(file)
}

async function handleSpreadsheetImport(file) {
  if (!file) return

  try {
    setStatus('正在解析表格数据...', 'live')
    importedSpreadsheet = await importSpreadsheetFile(file)
    syncSpreadsheetImportUI()
    setStatus(
      `已导入表格：${importedSpreadsheet.rowCount} 行，${importedSpreadsheet.columns.length} 列。`,
      'ok'
    )
  } catch (error) {
    importedSpreadsheet = null
    syncSpreadsheetImportUI()
    setStatus(error?.message || '表格导入失败。', 'error')
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
      node.style.border = '1px solid var(--border)'
      node.style.background = 'var(--surface)'
      node.style.borderRadius = '6px'
      node.style.transition =
        'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease'
      node.appendChild(createStreamSlotPlaceholder(slot))
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
    clearStreamSlotPlaceholderState(entry)
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

  function markRetrying(ids) {
    ids.forEach((id) =>
      setStreamSlotPlaceholderState(slotMap.get(id), 'retrying')
    )
  }

  function markRetryFailed(ids) {
    ids.forEach((id) =>
      setStreamSlotPlaceholderState(slotMap.get(id), 'failed')
    )
  }

  function stop() {
    slotMap.forEach((entry) => entry.result?.stopAnimations?.())
  }

  return {
    applyLayout,
    renderChart,
    markRetrying,
    markRetryFailed,
    stop,
    getLayout: () => layout
  }
}

function createStreamSlotPlaceholder(slot) {
  const placeholder = document.createElement('div')
  placeholder.className = 'stream-slot-preview__placeholder'
  placeholder.dataset.state = 'waiting'
  placeholder.style.position = 'absolute'
  placeholder.style.inset = '0'
  placeholder.style.display = 'flex'
  placeholder.style.alignItems = 'center'
  placeholder.style.justifyContent = 'center'
  placeholder.style.flexDirection = 'column'
  placeholder.style.gap = '6px'
  placeholder.style.padding = '12px'
  placeholder.style.boxSizing = 'border-box'
  placeholder.style.color = 'var(--muted)'
  placeholder.style.fontSize = '12px'
  placeholder.style.lineHeight = '1.4'
  placeholder.style.textAlign = 'center'
  placeholder.style.pointerEvents = 'none'

  const spinner = document.createElement('div')
  spinner.className = 'stream-slot-preview__retry-spinner'
  spinner.hidden = true
  spinner.style.width = '18px'
  spinner.style.height = '18px'
  spinner.style.border = '2px solid rgba(79, 70, 229, 0.18)'
  spinner.style.borderTopColor = 'var(--accent)'
  spinner.style.borderRadius = '50%'
  spinner.style.animation = 'stream-slot-retry-spin 0.75s linear infinite'

  const label = document.createElement('div')
  label.className = 'stream-slot-preview__label'
  label.textContent = String(slot.id || 'slot')

  const hint = document.createElement('div')
  hint.className = 'stream-slot-preview__hint'
  hint.textContent = 'Waiting'
  hint.style.letterSpacing = '0'

  placeholder.append(spinner, label, hint)
  return placeholder
}

function setStreamSlotPlaceholderState(entry, state) {
  if (!entry?.node || entry.result) return
  const placeholder = entry.node.querySelector(
    '.stream-slot-preview__placeholder'
  )
  if (!placeholder) return

  const spinner = placeholder.querySelector(
    '.stream-slot-preview__retry-spinner'
  )
  const hint = placeholder.querySelector('.stream-slot-preview__hint')

  entry.node.classList.remove('is-retrying', 'is-retry-failed')
  placeholder.dataset.state = state
  placeholder.style.animation = ''
  entry.node.style.border = '1px solid var(--border)'
  entry.node.style.background = 'var(--surface)'
  entry.node.style.boxShadow = 'none'

  if (state === 'retrying') {
    entry.node.classList.add('is-retrying')
    entry.node.style.border = '1px solid rgba(79, 70, 229, 0.42)'
    entry.node.style.background =
      'linear-gradient(180deg, rgba(79, 70, 229, 0.06), rgba(255, 255, 255, 0.94))'
    entry.node.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.08)'
    placeholder.style.animation =
      'stream-slot-retry-pulse 1.2s ease-in-out infinite'
    if (spinner) {
      spinner.hidden = false
      spinner.style.animation = 'stream-slot-retry-spin 0.75s linear infinite'
      spinner.style.border = '2px solid rgba(79, 70, 229, 0.18)'
      spinner.style.borderTopColor = 'var(--accent)'
    }
    if (hint) hint.textContent = 'Retrying'
    return
  }

  if (state === 'failed') {
    entry.node.classList.add('is-retry-failed')
    entry.node.style.border = '1px solid rgba(239, 68, 68, 0.42)'
    entry.node.style.background =
      'linear-gradient(180deg, rgba(239, 68, 68, 0.06), rgba(255, 255, 255, 0.94))'
    entry.node.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.08)'
    if (spinner) {
      spinner.hidden = false
      spinner.style.animation = 'none'
      spinner.style.border = '2px solid rgba(239, 68, 68, 0.32)'
      spinner.style.borderTopColor = 'var(--danger)'
    }
    if (hint) hint.textContent = 'Retry failed'
    return
  }

  if (spinner) spinner.hidden = true
  if (hint) hint.textContent = 'Waiting'
}

function clearStreamSlotPlaceholderState(entry) {
  if (!entry?.node) return
  entry.node.classList.remove('is-retrying', 'is-retry-failed')
  entry.node.style.border = '1px solid var(--border)'
  entry.node.style.background = 'var(--surface)'
  entry.node.style.boxShadow = 'none'
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
  if (!needsGrid)
    return frames.map((slot) => normalizeSlotFrame(slot, width, height))

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

function getStreamEventId(event) {
  const id = event?.id || event?.slot || event?.key || event?.chartId
  return id === undefined || id === null ? '' : String(id)
}

function getExpectedStreamSlotIds(state = lastStreamSlotState) {
  if (!state?.layout) return []
  const dimensions = state.dimensions ||
    lastRenderedDimensions || {
      width: parseInt(canvasWidthInput.value) || 640,
      height: parseInt(canvasHeightInput.value) || 480
    }

  return getStreamSlotFrames(
    state.layout,
    dimensions.width,
    dimensions.height
  ).map((slot) => slot.id)
}

function getFailedStreamChartIds(errors = []) {
  if (!lastStreamSlotState) return []

  const failedIds = new Set()
  const expectedIds = getExpectedStreamSlotIds(lastStreamSlotState)
  expectedIds.forEach((id) => {
    if (!lastStreamSlotState.charts.has(id)) failedIds.add(id)
  })

  errors
    .map(getStreamEventId)
    .filter(Boolean)
    .forEach((id) => {
      if (!lastStreamSlotState.charts.has(id)) failedIds.add(id)
    })

  return [...failedIds]
}

function createStreamSlotSpecFromState(state = lastStreamSlotState) {
  if (!state?.layout) return null
  const ids = getExpectedStreamSlotIds(state)
  const children = ids
    .map((id) => state.charts.get(id)?.spec)
    .filter((spec) => spec && typeof spec === 'object')

  if (children.length === 0) return null
  if (children.length === 1 && ids.length <= 1) return children[0]

  const layout = state.layout || {}
  const view = layout.view || layout

  return {
    ...(layout.width && { width: layout.width }),
    ...(layout.height && { height: layout.height }),
    ...(layout.padding !== undefined && { padding: layout.padding }),
    view: {
      type: view.type || layout.type || 'row',
      ...(view.padding !== undefined && { padding: view.padding }),
      children
    }
  }
}

function createStreamChartRepairPrompt({
  originalPrompt,
  canvasWidth,
  canvasHeight,
  failedIds,
  errors = []
}) {
  const layout = lastStreamSlotState?.layout || null
  const spreadsheetContext = getSpreadsheetPromptContext()
  const validIds = lastStreamSlotState
    ? [...lastStreamSlotState.charts.keys()]
    : []
  const compactErrors = errors.map((error) => ({
    id: getStreamEventId(error) || undefined,
    code: error?.code || 'unknown',
    lineNumber: error?.lineNumber,
    message: error?.message,
    validation: Array.isArray(error?.validation?.errors)
      ? error.validation.errors.map(({ code, path, message }) => ({
          code,
          path,
          message
        }))
      : undefined,
    raw: error?.raw ? String(error.raw).slice(0, 500) : undefined
  }))

  return [
    'Repair failed Sparrow multi-chart NDJSON output.',
    `Original user request: ${originalPrompt}`,
    `Canvas size: ${canvasWidth}x${canvasHeight}.`,
    ...(spreadsheetContext
      ? [`Imported data context: ${spreadsheetContext}`]
      : []),
    `Existing layout: ${JSON.stringify(layout)}`,
    `Already valid chart ids: ${JSON.stringify(validIds)}`,
    `Failed chart ids: ${JSON.stringify(failedIds)}`,
    `Errors: ${JSON.stringify(compactErrors)}`,
    'Output NDJSON only: one valid JSON object per line, no markdown fences and no prose.',
    'Do not output layout, start, or explanatory events.',
    'Emit exactly one {"type":"chart","id":"slot-id","spec": SparrowPlotSpecLeafOrViewChild } line per failed chart id.',
    'Use the exact failed ids and render each chart for its existing slot.'
  ].join('\n')
}

async function repairFailedStreamCharts({
  provider,
  originalPrompt,
  canvasWidth,
  canvasHeight,
  renderPreferences,
  errors,
  signal
}) {
  const failedIds = getFailedStreamChartIds(errors)
  if (failedIds.length === 0) return null

  const failedIdSet = new Set(failedIds)
  const repairedIds = new Set()
  const repairErrors = []

  streamSlotRenderer?.markRetrying?.(failedIds)
  setStatus(`Repairing ${failedIds.length} failed chart slot(s)...`, 'live')

  try {
    await streamPlotSpec({
      prompt: createStreamChartRepairPrompt({
        originalPrompt,
        canvasWidth,
        canvasHeight,
        failedIds,
        errors
      }),
      provider,
      streamFormat: 'ndjson',
      validate: getSpecValidator(),
      signal,
      render(spec) {
        return { node: previewNode, spec }
      },
      renderOptions: {
        container: previewNode,
        ...renderPreferences,
        width: canvasWidth,
        height: canvasHeight
      },
      onChunk(chunk) {
        streamLogNode.textContent += chunk
      },
      onChart(event) {
        const fallbackId = failedIds.length === 1 ? failedIds[0] : ''
        const id = getStreamEventId(event) || fallbackId
        if (!id || !failedIdSet.has(id)) return

        const repairEvent = {
          ...event,
          id,
          spec: bindImportedSpreadsheetData(event.spec)
        }
        rememberStreamSlotChart(repairEvent)
        const partialResult = streamSlotRenderer?.renderChart({
          ...repairEvent,
          spec: getEffectiveSpec(repairEvent.spec)
        })
        if (partialResult) {
          repairedIds.add(id)
          lastRenderResult = {
            node: previewNode,
            spec: createStreamSlotSpecFromState(),
            stopAnimations: () => streamSlotRenderer?.stop?.()
          }
        }
      },
      onParseError(error) {
        repairErrors.push(error)
      },
      onValidationError(error) {
        repairErrors.push(error)
      }
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    setStatus(error?.message || 'Chart repair failed.', 'error')
  }

  const remainingIds = failedIds.filter((id) => !repairedIds.has(id))
  streamSlotRenderer?.markRetryFailed?.(remainingIds)

  const spec = createStreamSlotSpecFromState()
  if (spec) {
    const effectiveSpec = getEffectiveSpec(spec)
    rememberRenderedSpec(effectiveSpec, {
      width: canvasWidth,
      height: canvasHeight
    })
    specJsonNode.textContent = JSON.stringify(effectiveSpec, null, 2)
  }

  return {
    failedIds,
    repairedIds: [...repairedIds],
    repairErrors,
    spec
  }
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
      lastRenderResult = renderAISpec(
        getEffectiveSpec(cloneSpec(lastRenderedSpec)),
        {
          container: previewNode,
          ...renderPreferences,
          ...(lastRenderedDimensions || {})
        }
      )
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
  const dimensions = lastStreamSlotState.dimensions ||
    lastRenderedDimensions || {
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

function createStreamSlotExportSpec() {
  const dimensions = lastStreamSlotState?.dimensions ||
    lastRenderedDimensions || {
      width: parseInt(canvasWidthInput.value) || 640,
      height: parseInt(canvasHeightInput.value) || 480
    }

  return {
    width: dimensions.width,
    height: dimensions.height
  }
}

function createStreamSlotExportRender(renderPreferences = {}) {
  return (_spec, renderOptions = {}) => {
    const dimensions = lastStreamSlotState?.dimensions ||
      lastRenderedDimensions || {
        width: renderOptions.width || parseInt(canvasWidthInput.value) || 640,
        height: renderOptions.height || parseInt(canvasHeightInput.value) || 480
      }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(dimensions.width))
    svg.setAttribute('height', String(dimensions.height))
    svg.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`)

    const frames = getStreamSlotFrames(
      lastStreamSlotState.layout,
      dimensions.width,
      dimensions.height
    )
    const charts = lastStreamSlotState.charts
    const results = []

    frames.forEach((slot) => {
      const event = charts.get(slot.id)
      if (!event?.spec) return

      const container = document.createElement('div')
      const result = renderAISpec(
        {
          ...getEffectiveSpec(cloneSpec(event.spec)),
          width: slot.width,
          height: slot.height
        },
        {
          ...renderPreferences,
          ...renderOptions,
          container,
          width: slot.width,
          height: slot.height
        }
      )
      const child = result?.node
      if (!child || child.tagName?.toLowerCase() !== 'svg') return

      child.setAttribute('x', String(slot.x))
      child.setAttribute('y', String(slot.y))
      child.setAttribute('width', String(slot.width))
      child.setAttribute('height', String(slot.height))
      svg.appendChild(child)
      results.push(result)
    })

    return {
      node: svg,
      plots: results.flatMap((result) => result.plots || []),
      marks: results.flatMap((result) => result.marks || []),
      views: results.flatMap((result) => result.views || []),
      playAnimations: () =>
        results.flatMap((result) => result.playAnimations?.() || []),
      stopAnimations: () =>
        results.forEach((result) => result.stopAnimations?.())
    }
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
    const exportSpec = lastStreamSlotState
      ? createStreamSlotExportSpec()
      : cloneSpec(lastRenderedSpec)
    await exportSpecAsPNG(exportSpec, {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      ...(lastStreamSlotState && {
        render: createStreamSlotExportRender(getRenderPreferences())
      }),
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
    const exportSpec = lastStreamSlotState
      ? createStreamSlotExportSpec()
      : cloneSpec(lastRenderedSpec)
    await exportSpecAsAPNG(exportSpec, {
      ...(lastRenderedDimensions || {}),
      ...getRenderPreferences(),
      ...(lastStreamSlotState && {
        render: createStreamSlotExportRender(getRenderPreferences())
      }),
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

function createConfiguredRAGProvider(provider, systemPrompt) {
  if (ragKnowledgeInput?.checked === false) return provider

  return createRAGPlotProvider(provider, {
    systemPrompt,
    remoteRetriever: (prompt, options) =>
      retrieveVectorSparrowSyntaxKnowledge(prompt, {
        ...options,
        endpoint: env.VITE_RAG_ENDPOINT || undefined
      }),
    fallbackToLocal: true
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
  if (ragKnowledgeInput) {
    ragKnowledgeInput.checked = stored.ragKnowledge
  }
  animateRenderInput.checked = stored.animateRender
  autoLayoutInput.checked = stored.autoLayout
  syncPromptPresetUI()
  syncConnectionModeUI()
}

if (hasPlaygroundPage) {
  populatePromptPresetOptions()
  initializeProviderSettings()
  syncChartActionButtons()
  syncSpreadsheetImportUI()
  closeExportMenu()
  setStatus(statusTextNode.textContent || '等待输入提示词')

  document.addEventListener('dragenter', handleSpreadsheetDragEnter)
  document.addEventListener('dragover', handleSpreadsheetDragOver)
  document.addEventListener('dragleave', handleSpreadsheetDragLeave)
  document.addEventListener('drop', handleSpreadsheetDrop)

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
  ragKnowledgeInput?.addEventListener('change', persistProviderSettings)
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

  document.querySelectorAll('.example-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt
      if (prompt && promptInput) {
        promptInput.value = prompt
        closeHelpModal()
        form.dispatchEvent(new Event('submit'))
      }
    })
  })

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
      const systemPrompt = withNDJSONStreamInstructions(
        promptPreset.systemPrompt
      )
      provider = createConfiguredRAGProvider(
        createConfiguredProvider(systemPrompt),
        systemPrompt
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
      let parseErrorCount = 0
      const parseErrors = []

      previewNode.style.width = `${canvasWidth}px`
      previewNode.style.height = `${canvasHeight}px`
      previewNode.style.margin = '0 auto'
      streamSlotRenderer = createStreamSlotRenderer({
        width: canvasWidth,
        height: canvasHeight,
        renderPreferences
      })

      const promptWithSize = appendSpreadsheetPromptContext(
        `Canvas size: ${canvasWidth}x${canvasHeight}. Put id, x, y, width, and height in layout.slots for each chart. ${prompt}`
      )

      let result
      try {
        result = await streamPlotSpec({
          prompt: promptWithSize,
          provider,
          streamFormat: 'ndjson',
          validate: getSpecValidator(),
          signal: controller.signal,
          render(spec, renderOptions) {
            if (streamSlotRenderer?.getLayout?.()) {
              return { node: previewNode, spec }
            }

            const effectiveSpec = getEffectiveSpec(
              bindImportedSpreadsheetData(spec)
            )
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
            const spreadsheetEvent = {
              ...event,
              spec: bindImportedSpreadsheetData(event.spec)
            }
            rememberStreamSlotChart(spreadsheetEvent)
            const partialResult = streamSlotRenderer?.renderChart({
              ...spreadsheetEvent,
              spec: getEffectiveSpec(spreadsheetEvent.spec)
            })
            if (partialResult) {
              lastRenderResult = {
                node: previewNode,
                spec: bindImportedSpreadsheetData(snapshot.spec),
                stopAnimations: () => streamSlotRenderer?.stop?.()
              }
            }
            setStatus(
              `Received ${snapshot.charts.length} chart chunk(s); rendering incrementally...`,
              'live'
            )
          },
          onParseError(error, snapshot) {
            parseErrorCount += 1
            parseErrors.push(error)
            const lineSuffix = error?.lineNumber
              ? ` at line ${error.lineNumber}`
              : ''
            const chartCount = snapshot?.charts?.length || 0
            setStatus(
              `Skipped ${parseErrorCount} invalid JSON line(s)${lineSuffix}; ${chartCount} chart chunk(s) still parsed.`,
              'live'
            )
          },
          onValidationError(error, snapshot) {
            parseErrorCount += 1
            parseErrors.push(error)
            const idSuffix = getStreamEventId(error)
              ? ` for ${getStreamEventId(error)}`
              : ''
            const chartCount = snapshot?.charts?.length || 0
            setStatus(
              `Skipped ${parseErrorCount} invalid Sparrow spec chunk(s)${idSuffix}; ${chartCount} chart chunk(s) still parsed.`,
              'live'
            )
          },
          onSpec(spec) {
            const effectiveSpec = getEffectiveSpec(
              bindImportedSpreadsheetData(spec)
            )
            rememberRenderedSpec(effectiveSpec, {
              width: canvasWidth,
              height: canvasHeight
            })
            specJsonNode.textContent = JSON.stringify(effectiveSpec, null, 2)

            const { typeLabel, count, layoutLabel } =
              summarizeSpec(effectiveSpec)
            setSummary(
              layoutLabel
                ? `${layoutLabel} / ${typeLabel} / ${count} 条数据`
                : `${typeLabel} / ${count} 条数据`,
              true
            )
          },
          onRender(result, spec) {
            lastRenderResult = result
            const effectiveSpec = getEffectiveSpec(
              bindImportedSpreadsheetData(spec)
            )
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
      } catch (error) {
        if (
          error?.name === 'AbortError' ||
          parseErrors.length === 0 ||
          !lastStreamSlotState
        ) {
          throw error
        }

        result = {
          spec: createStreamSlotSpecFromState(),
          result: { node: previewNode }
        }
      }

      const repairOutcome = await repairFailedStreamCharts({
        provider,
        originalPrompt: prompt,
        canvasWidth,
        canvasHeight,
        renderPreferences,
        errors: parseErrors,
        signal: controller.signal
      })

      const finalSpec = bindImportedSpreadsheetData(
        repairOutcome?.spec || result.spec
      )
      if (!finalSpec) {
        throw new Error('No valid Sparrow spec was generated or repaired.')
      }

      const effectiveSpec = getEffectiveSpec(finalSpec)
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
