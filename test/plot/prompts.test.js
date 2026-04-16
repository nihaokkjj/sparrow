import { expect, test } from 'vitest'
import {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  DEFAULT_PLOT_SPEC_SYSTEM_PROMPT,
  MINIMAL_PLOT_SPEC_SYSTEM_PROMPT,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets
} from '../../src/plot/index.js'

test('default plot spec preset resolves to sparrow-spec-creator skill prompt', () => {
  const preset = getPlotSpecPromptPreset()

  expect(DEFAULT_PLOT_SPEC_PROMPT_PRESET).toBe('sparrow-spec-creator')
  expect(preset.id).toBe('sparrow-spec-creator')
  expect(DEFAULT_PLOT_SPEC_SYSTEM_PROMPT).toBe(preset.systemPrompt)
  expect(preset.systemPrompt).toContain('SparrowPlotSpec generation rules')
  expect(preset.systemPrompt).toContain('Use `plots` when multiple marks')
  expect(preset.systemPrompt).toContain('facet')
  expect(preset.systemPrompt).toContain('draw-in')
})

test('listPlotSpecPromptPresets() includes minimal and skill-backed presets', () => {
  const presets = listPlotSpecPromptPresets()
  const ids = presets.map((preset) => preset.id)

  expect(ids).toContain('sparrow-spec-creator')
  expect(ids).toContain('default-minimal')
  expect(getPlotSpecPromptPreset('default-minimal').systemPrompt).toBe(
    MINIMAL_PLOT_SPEC_SYSTEM_PROMPT
  )
})

test('getPlotSpecPromptPreset() falls back to the default preset for unknown ids', () => {
  expect(getPlotSpecPromptPreset('missing-preset').id).toBe(
    DEFAULT_PLOT_SPEC_PROMPT_PRESET
  )
})
