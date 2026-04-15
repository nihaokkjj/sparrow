import rawSparrowSpecCreatorPrompt from '../../skills/sparrow-spec-creator/references/prompt.md?raw'

export const MINIMAL_PLOT_SPEC_SYSTEM_PROMPT = [
  'You generate SparrowPlotSpec JSON only for the Sparrow runtime.',
  'Return exactly one SparrowPlotSpec JSON object with keys such as width, height, padding, coordinate, plot, plots, view, scales, and guides.',
  'Use plot for one layer, or plots for multiple layered marks in the same view.',
  'Use view for multi-panel layouts. view.type may be row, col, layer, or facet, and view.children may contain nested views or plot leaves.',
  'Prefer plots over view.type layer when marks should share the same scales and guides.',
  'Only use plot.type or plots[].type values point, line, interval, pie, area, rect, cell, or text.',
  'plot.data must be an array of plain JSON objects.',
  'For pie marks, use encodings.angle for slice values and optional fill for categories.',
  'plot.encodings must map channel names like x, y, angle, fill, stroke, r to field names or constants.',
  'Do not return Markdown unless the SparrowPlotSpec JSON is inside a single fenced json block.',
  'Do not include explanations before or after the SparrowPlotSpec JSON.'
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

export const DEFAULT_PLOT_SPEC_SYSTEM_PROMPT = getPlotSpecPromptPreset()
  .systemPrompt

export function getPlotSpecPromptPreset(
  id = DEFAULT_PLOT_SPEC_PROMPT_PRESET
) {
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
