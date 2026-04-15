---
name: sparrow-spec-creator
description: Generate SparrowPlotSpec JSON outputs for this repo. Use when asked to turn natural-language chart requests into Sparrow specs, to output prompt-safe JSON for `streamPlotSpec()`, or to choose between `plot`, `plots`, and `view`.
---

# Sparrow Spec Creator

## Overview

Generate a single `SparrowPlotSpec` JSON object for the Sparrow runtime.

## Workflow

1. Read `references/prompt.md` for the JSON contract, supported marks, layout rules, and output constraints.
2. Extract the user's chart intent: single chart, layered chart, or multi-panel view.
3. Choose the root shape:
   - `plot` for one mark
   - `plots` for multiple layered marks sharing the same view
   - `view` for `row`, `col`, `layer`, or `facet` layouts
4. Build concrete `data`, `encodings`, `scales`, `guides`, and `styles` with conservative defaults.
5. Self-check that the output stays inside Sparrow's supported runtime surface.

## Notes

- Prefer valid JSON over ambitious styling.
- If the requested chart type is unsupported, translate it to the closest supported composition instead of inventing new mark types.
- Do not output explanations before or after the JSON unless the user explicitly asks for commentary.
