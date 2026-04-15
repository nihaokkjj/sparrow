# Sparrow architecture map

## Public surfaces

- `src/index.js`: root renderer, coordinate, scale, and statistic exports
- `src/plot/index.js`: plot runtime and AI playground exports
- `src/guide/index.js`: guide exports
- `src/views/index.js`: layout exports
- `README.md`: public usage and AI playground contract
- `index.html` and `playground.html`: browser playground UI

## Plot runtime ownership

Use these files when the change belongs to chart rendering:

- `src/plot/create.js`: node registry for marks, guides, coordinates, and statistics
- `src/plot/encoding.js`: channel initialization and encoding preparation
- `src/plot/plot.js`: scale inference and scaled channel application
- `src/plot/guide.js`: guide inference
- `src/plot/scale.js`: plot-side scale helpers
- `src/plot/renderPlotSpec.js`: single-view plot normalization and rendering
- `src/plot/renderAISpec.js`: multi-view orchestration for `row`, `col`, `layer`, and `facet`
- `src/plot/playground.js`: AI prompt contract, provider messages, chunk parsing, and streaming flow
- `src/plot/providerConfig.js`: direct/proxy request configuration

## View layout ownership

Use these files when the change belongs to layout computation:

- `src/views/view.js`: view tree traversal and layout dispatch
- `src/views/flex.js`: `row` and `col`
- `src/views/layer.js`: layered frames
- `src/views/facet.js`: grouped panel splitting

## Guide ownership

Use these files when the change belongs to axes or legends:

- `src/guide/axis.js`
- `src/guide/axisX.js`
- `src/guide/axisY.js`
- `src/guide/grid.js`
- `src/guide/ticks.js`
- `src/guide/legendRamp.js`
- `src/guide/legendSwatches.js`

## Common change recipes

### Add or change an AI output rule

Touch these together when needed:

- `src/plot/playground.js`
- `test/plot/playground.test.js`
- `README.md`
- any local skill prompt that mirrors the runtime contract

### Add or change a supported mark

Usually touch:

- `src/geometry/*`
- `src/plot/create.js`
- `src/plot/renderPlotSpec.js`
- `test/plot/renderPlotSpec.test.js`
- `test/plot/create.test.js`

### Add or change a view behavior

Usually touch:

- `src/views/*`
- `src/plot/renderAISpec.js`
- `test/views/*.test.js`
- `test/plot/renderAISpec.test.js`

### Change public exports

Keep the export surface aligned across:

- `src/index.js`
- `src/plot/index.js`
- `src/guide/index.js`
- `src/views/index.js`
- `test/public/subpaths.test.js`
- `README.md`

## Repo rules for contributors

- Fix behavior at the owning layer, not in the demo page.
- Keep the AI contract strict and machine-friendly.
- Reuse existing registries and helpers before adding new top-level abstractions.
- If a browser playground change affects both entry pages, keep `index.html` and `playground.html` in sync.
