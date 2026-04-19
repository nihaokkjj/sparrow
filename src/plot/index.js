export { create, register } from './create.js'
export { initialize } from './encoding.js'
export { inferGuides } from './guide.js'
export { inferScales, applyScales } from './plot.js'
export { renderPlotSpec } from './renderPlotSpec.js'
export { renderAISpec } from './renderAISpec.js'
export { applyPlaygroundAnimationPreference } from './playgroundAnimationPreference.js'
export {
  DEFAULT_PLOT_SPEC_PROMPT_PRESET,
  DEFAULT_PLOT_SPEC_SYSTEM_PROMPT,
  MINIMAL_PLOT_SPEC_SYSTEM_PROMPT,
  PLOT_SPEC_PROMPT_PRESETS,
  SPARROW_SPEC_CREATOR_SYSTEM_PROMPT,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets
} from './prompts.js'
export {
  createPlotSpecMessages,
  parsePlotSpecResponse,
  createPlotSpecChunkBuffer,
  streamPlotSpec,
  createOpenAICompatibleProvider,
  createMockPlotProvider
} from './playground.js'
export {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_PLAYGROUND_OPENAI_MODEL,
  DEFAULT_PLAYGROUND_PROVIDER,
  DEFAULT_OPENAI_PROXY_PATH,
  OPENAI_PROXY_TARGET_HEADER,
  buildOpenAICompatibleRequestURL,
  buildProviderRequestConfig,
  buildProxyTargetURL,
  getDefaultPlaygroundProviderSettings,
  getPlaygroundProviderProfile,
  normalizePlaygroundProvider,
  normalizeProxyPath
} from './providerConfig.js'
