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
  expect(preset.systemPrompt).toContain('guides.x.position')
  expect(preset.systemPrompt).toContain('guides.color.position')
  expect(preset.systemPrompt).toContain('multiple independent pie charts')
  expect(preset.systemPrompt).toContain('Do not wrap nested views')
})

test('listPlotSpecPromptPresets() includes minimal and skill-backed presets', () => {
  const presets = listPlotSpecPromptPresets()
  const ids = presets.map((preset) => preset.id)
  const minimalPrompt = getPlotSpecPromptPreset('default-minimal').systemPrompt

  expect(ids).toContain('sparrow-spec-creator')
  expect(ids).toContain('default-minimal')
  expect(minimalPrompt).toBe(MINIMAL_PLOT_SPEC_SYSTEM_PROMPT)
  expect(minimalPrompt).toContain('Supported view.type values are row, col, layer, and facet.')
  expect(minimalPrompt).toContain('Multiple independent pie charts should use view layouts instead of plots.')
  expect(minimalPrompt).toContain('Do not wrap nested views')
  expect(minimalPrompt).not.toContain('guides.x.position')
  expect(minimalPrompt).not.toContain('grow-y')
  expect(minimalPrompt.length).toBeLessThan(DEFAULT_PLOT_SPEC_SYSTEM_PROMPT.length)
})

test('getPlotSpecPromptPreset() falls back to the default preset for unknown ids', () => {
  expect(getPlotSpecPromptPreset('missing-preset').id).toBe(
    DEFAULT_PLOT_SPEC_PROMPT_PRESET
  )
})
