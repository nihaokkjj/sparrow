import rawSparrowSpecCreatorPrompt from '../../skills/sparrow-spec-creator/references/prompt.md?raw'

export const MINIMAL_PLOT_SPEC_SYSTEM_PROMPT = [
  'You generate SparrowPlotSpec JSON only for the Sparrow runtime.',
  'Return exactly one SparrowPlotSpec JSON object, optionally wrapped in one fenced json block, with no prose before or after it.',
  'Use plot for one leaf chart, plots for layered marks in one panel, and view for multi-panel layouts.',
  'A single leaf chart should look like { "plot": { "type": "...", "data": [...], "encodings": {...} } }.',
  'The mark name must be written in type, such as plot.type, plots[].type, or a direct leaf spec.type. Do not use plot.mark or a separate mark key.',
  'Supported view.type values are row, col, layer, and facet.',
  'In view.children, nested views must be direct objects with type and children. Do not wrap nested views inside { "view": { ... } }.',
  'View children may be nested view nodes, { plot: {...} }, { plots: [...] }, or direct leaf mark specs.',
  'When many independent panels are requested without an explicit direction, prefer a near-square nested row/col layout instead of a long strip.',
  'Do not use empty text, point, rect, or other marks as layout placeholders.',
  'Only use mark types point, line, interval, pie, area, rect, cell, and text.',
  'Leaf plot data must be arrays of plain JSON objects.',
  'For pie, use encodings.angle for slice values and fill for categories. Multiple independent pie charts should use view layouts instead of plots.',
  'If you use animation.enter as an object, write animation.enter.preset instead of animation.enter.type.',
  'Allowed animation ease values are linear, easeIn, easeOut, and easeInOut. Do not use kebab-case values like ease-out.',
  'Do not output custom JavaScript, callbacks, or unsupported runtime fields.'
].join(' ')

export const SPARROW_SPEC_CREATOR_SYSTEM_PROMPT = normalizePrompt(
  rawSparrowSpecCreatorPrompt
)

export const DEFAULT_PLOT_SPEC_PROMPT_PRESET = 'sparrow-spec-creator'

export const PLOT_SPEC_PROMPT_PRESETS = Object.freeze({
  [DEFAULT_PLOT_SPEC_PROMPT_PRESET]: Object.freeze({
    id: DEFAULT_PLOT_SPEC_PROMPT_PRESET,
    label: 'Skill: sparrow-spec-creator',
    description:
      'Use the repo skill contract with supported marks, layouts, defaults, and JSON self-check rules.',
    systemPrompt: SPARROW_SPEC_CREATOR_SYSTEM_PROMPT
  }),
  'default-minimal': Object.freeze({
    id: 'default-minimal',
    label: 'Minimal JSON contract',
    description:
      'Use the older compact prompt with only the core Sparrow JSON constraints.',
    systemPrompt: MINIMAL_PLOT_SPEC_SYSTEM_PROMPT
  })
})

export const DEFAULT_PLOT_SPEC_SYSTEM_PROMPT =
  getPlotSpecPromptPreset().systemPrompt

export function getPlotSpecPromptPreset(id = DEFAULT_PLOT_SPEC_PROMPT_PRESET) {
  return (
    PLOT_SPEC_PROMPT_PRESETS[id] ||
    PLOT_SPEC_PROMPT_PRESETS[DEFAULT_PLOT_SPEC_PROMPT_PRESET]
  )
}

export function listPlotSpecPromptPresets() {
  return Object.values(PLOT_SPEC_PROMPT_PRESETS)
}

function normalizePrompt(value) {
  return String(value || '')
    .replace(/^---[\s\S]*?---\s*/, '')
    .trim()
}
