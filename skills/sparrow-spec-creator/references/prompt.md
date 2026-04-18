# SparrowPlotSpec generation rules

## Goal

- **Input**: a chart request in natural language.
- **Output**: exactly one `SparrowPlotSpec` JSON object for Sparrow's AI playground and `renderAISpec()`.

## Output contract

- Return exactly one JSON object.
- You may wrap the object in one fenced `json` block.
- Do not return Markdown prose, bullets, or explanations outside the JSON.
- Use explicit object keys and arrays only; do not use comments or trailing commas.

## Root shapes

Choose exactly one of these shapes:

1. **Single view, single mark**

```json
{
  "plot": {
    "type": "interval",
    "data": [{ "category": "A", "value": 12 }],
    "encodings": { "x": "category", "y": "value" }
  }
}
```

2. **Single view, layered marks sharing scales**

```json
{
  "plots": [
    {
      "type": "area",
      "data": [{ "month": "Jan", "value": 12 }],
      "encodings": { "x": "month", "y": "value" }
    },
    {
      "type": "line",
      "data": [{ "month": "Jan", "value": 12 }],
      "encodings": { "x": "month", "y": "value" }
    }
  ]
}
```

3. **Multi-panel layout**

```json
{
  "width": 900,
  "height": 360,
  "view": {
    "type": "row",
    "padding": 24,
    "children": [
      {
        "type": "interval",
        "data": [{ "category": "A", "value": 3 }],
        "encodings": { "x": "category", "y": "value" }
      },
      {
        "type": "line",
        "data": [{ "step": "Q1", "value": 2 }],
        "encodings": { "x": "step", "y": "value" }
      }
    ]
  }
}
```

4. **Facet layout (repeat chart by group)**

```json
{
  "width": 900,
  "height": 360,
  "view": {
    "type": "facet",
    "data": [
      { "region": "华东", "month": "Jan", "sales": 45 },
      { "region": "华东", "month": "Feb", "sales": 52 },
      { "region": "华南", "month": "Jan", "sales": 38 },
      { "region": "华南", "month": "Feb", "sales": 41 }
    ],
    "facet": {
      "by": "region"
    },
    "children": [
      {
        "type": "line",
        "encodings": {
          "x": "month",
          "y": "sales"
        }
      }
    ]
  }
}
```

## Supported runtime surface

### Marks

Only use these mark types:

- `point`
- `line`
- `interval`
- `pie`
- `area`
- `rect`
- `cell`
- `text`

Do not use `link`, `path`, or any other unlisted mark type.

### Views

Only use these `view.type` values:

- `row`
- `col`
- `layer`
- `facet`

- In `view.children`, nested views must be written directly as objects with `type` and `children`.
- Do not wrap nested views in an extra `{ "view": { ... } }` object.

### Data

- `plot.data` must be an array of plain JSON objects.
- For `view` specs, shared `data` may live on the nearest common parent.
- In `facet` views, use `facet.by` to specify the grouping field (not `encodings`). Put the full dataset on the facet node and let child plots inherit filtered data.

### Encodings

- `encodings` should map channels to field names or constants.
- Prefer common channels such as `x`, `y`, `angle`, `fill`, `stroke`, `r`, and `text`.
- For `pie`, use `encodings.angle` for slice values and `fill` for categories.
- For multiple independent pie charts, use `view` instead of `plots`.
- Use `row` or `col` when the number of pie charts is fixed.
- Use `facet` when the same pie chart should repeat over grouped data.
- Keep channel names simple and consistent with the chosen mark.

### Animation

- Animation is optional and belongs on leaf plot specs.
- Use `animation.enter` for first-render entrance motion.
- `animation.enter` may be a preset string such as `"sweep-in"` or an object such as `{ "preset": "sweep-in", "duration": 900, "ease": "easeOut" }`.
- In object form, use `preset` as the field name. Do not use `type` inside `animation.enter`.
- Supported presets are `fade-in`, `rise-in`, `grow-y`, `pop-in`, `stagger-rise-in`, `sweep-in`, and `draw-in`.
- Use `grow-y` for `interval`, `rect`, `cell`, and `area`; `pop-in` for `point`; `draw-in` for `line`; `sweep-in` for `pie`; `rise-in` for `text`.
- You may add `duration`, `ease`, `delay`, and `stagger`.
- Supported `ease` values are `linear`, `easeIn`, `easeOut`, and `easeInOut`.
- Do not use kebab-case ease names such as `ease-out`, `ease-in`, or `ease-in-out`.
- Do not output JavaScript callbacks or unsupported animation fields.

### Guides

- Guide options may include `position`.
- Use `guides.x.position` only as `top` or `bottom`.
- Use `guides.y.position` only as `left` or `right`.
- Use `guides.color.position` only as `top`, `right`, `bottom`, or `left`.
- Prefer default guide positions unless the user asks to move axes or legends.
- Use explicit `guides.color.x` or `guides.color.y` only when the user asks for precise legend placement.

## Layout rules

- Use `plot` for one mark in one view.
- Use `plots` when multiple marks should share the same scales and guides.
- Use `view` only when panels need separate layout regions.
- In `view.children`, use one of these child shapes directly: a nested view node, `{ "type": "interval", ... }`, `{ "plots": [...] }`, or a direct leaf mark spec.
- Prefer `plots` over `view.type = "layer"` when the chart is just a layered composition in one panel.
- Use `facet` when the same child chart should repeat over grouped data.
- Do not use `plots` to place multiple separate pie charts side by side; that should be a `view` layout.
- When a request asks for many independent panels without an explicit direction, prefer a near-square nested `row`/`col` layout over a very long single strip.
- If a single `row` or `col` would make child plot areas too small, rebalance the children into nested `row`/`col` groups before finishing.
- Do not create empty `text`, `point`, `rect`, or other marks as layout placeholders. Use only real charts in the JSON; the runtime can handle spacing for incomplete rows.

## Conservative defaults

- Add `width` and `height` only when the user asks for size or a multi-panel layout benefits from an explicit canvas.
- Prefer `guides: false` for compact examples unless axes or legends are important to the task.
- For bar or column charts, usually set `scales.y.zero` to `true`.
- For ordered categories on a line or area chart, usually set `scales.x.type` to `dot`.
- Keep `styles` minimal and explicit.

## What to infer

Infer these pieces when the user does not specify them:

- a nearest supported mark type
- whether the request is single-mark, layered, or multi-panel
- a small but realistic demo dataset
- sensible scale defaults

Do not infer unsupported runtime features.

## Self-check

Before finishing, confirm:

- output is valid JSON
- there is exactly one root object
- every plot uses a supported mark type
- `data` is an array wherever a leaf plot needs it
- `view.type` is one of `row`, `col`, `layer`, or `facet`
- guide positions use only the allowed values for x, y, and color
- you did not add prose outside the JSON
