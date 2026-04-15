# Sparrow testing guide

## Smallest-first validation

Start with the narrowest test surface that matches the change:

- `test/plot/playground.test.js`: AI prompt, provider streaming, chunk parsing, proxy config
- `test/plot/renderPlotSpec.test.js`: single-view spec rendering
- `test/plot/renderAISpec.test.js`: nested view and facet rendering
- `test/plot/create.test.js`: registry behavior
- `test/plot/encoding.test.js`: encoding initialization
- `test/plot/plot.test.js`: scale inference and plot plumbing
- `test/guide/axis.test.js` and `test/guide/legend.test.js`: guide rendering
- `test/views/*.test.js`: layout computation
- `test/public/subpaths.test.js`: exported API surface

## Validation expectations by change type

### Prompt or AI contract changes

Verify:

- request messages still include the intended system prompt
- streamed content still parses incrementally
- invalid or partial JSON is still tolerated until complete

Primary files:

- `test/plot/playground.test.js`

### Plot rendering changes

Verify:

- normalized specs still reject unsupported mark types
- marks render with expected SVG output
- scale descriptors and guides remain stable

Primary files:

- `test/plot/renderPlotSpec.test.js`
- `test/plot/plot.test.js`

### View layout changes

Verify:

- child panels receive correct frames
- facet filtering still scopes inherited data correctly

Primary files:

- `test/views/*.test.js`
- `test/plot/renderAISpec.test.js`

### Public API changes

Verify:

- subpath exports still resolve
- README examples still match the shipped API

Primary files:

- `test/public/subpaths.test.js`

## Useful commands

- Targeted Vitest run: `pnpm vitest run test/plot/playground.test.js`
- Full test suite: `pnpm test`
- Build package artifacts: `pnpm build`
- Browser-focused example test: `pnpm test:browser:example`

## Contributor checklist

- add or update the smallest relevant tests first
- broaden to `pnpm test` only after the focused surface is stable
- update `README.md` when the public contract changes
- keep duplicated playground pages aligned when UI behavior changes
