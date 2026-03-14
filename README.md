# Sparrow

Lightweight SVG renderer and visualization primitives.

Sparrow is a small front-end rendering library centered around an SVG renderer.
The current published package focuses on the stable renderer API exposed by
`createRenderer`.

![Sparrow renderer example](./docs/readme-example.svg)

## Install

```bash
npm install @ksj_sparrow/sparrow
```

or

```bash
pnpm add @ksj_sparrow/sparrow
```

## Quick Start

```js
import { createRenderer } from '@ksj_sparrow/sparrow'

const renderer = createRenderer(420, 240)

renderer.rect({
  x: 24,
  y: 24,
  width: 140,
  height: 82,
  fill: '#91d5ff',
  stroke: '#1677ff',
  strokeWidth: 2
})

renderer.circle({
  cx: 270,
  cy: 76,
  r: 34,
  fill: '#ffd666',
  stroke: '#d48806',
  strokeWidth: 2
})

renderer.line({
  x1: 36,
  y1: 186,
  x2: 364,
  y2: 136,
  stroke: '#722ed1',
  strokeWidth: 3
})

renderer.text({
  x: 210,
  y: 220,
  text: 'Hello Sparrow',
  textAnchor: 'middle',
  fill: '#333',
  fontSize: 18
})

document.querySelector('#app').appendChild(renderer.node())
```

## Browser Example

If you are using Sparrow in a Vite or other ESM-based front-end project, a
minimal page can look like this:

```html
<div id="app"></div>

<script type="module">
  import { createRenderer } from '@ksj_sparrow/sparrow'

  const renderer = createRenderer(320, 180)
  renderer.rect({
    x: 20,
    y: 20,
    width: 120,
    height: 70,
    fill: '#b7eb8f',
    stroke: '#389e0d',
    strokeWidth: 2
  })
  renderer.text({
    x: 160,
    y: 150,
    text: 'Rendered in the browser',
    textAnchor: 'middle',
    fill: '#333'
  })

  document.getElementById('app').appendChild(renderer.node())
</script>
```

## API Overview

`createRenderer(width, height)` returns an SVG renderer instance with these
core methods:

- `line(options)`
- `rect(options)`
- `circle(options)`
- `text(options)`
- `path(options)`
- `ring(options)`
- `translate(tx, ty)`
- `rotate(theta)`
- `scale(sx, sy)`
- `save()`
- `restore()`
- `animate(element, from, to, options)`
- `tween(options)`
- `sequence(steps)`
- `stagger(items, factory, options)`
- `node()`
- `group()`

## Notes

- `node()` returns the root `<svg>` element, which you can append directly to
  the DOM.
- `group()` returns the current `<g>` element used for drawing.
- `rect()` supports negative `width` and `height` values by normalizing the
  final SVG attributes.
- `path()` accepts an array-based path DSL such as
  `[['M', 0, 0], ['L', 100, 100], ['Z']]`.
- `save()` and `restore()` let you isolate transforms on nested `<g>` groups.

## Package Scope

This npm package currently focuses on the stable renderer entry point:

```js
import { createRenderer } from '@ksj_sparrow/sparrow'
```

The repository also contains higher-level modules such as scale, coordinate,
guide, statistic, plot, and views. Those modules are still evolving in the
repository and are not yet treated as stable public APIs for the published
package.

## Development

Requirements:

- Node.js 18+
- pnpm recommended

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

Build artifacts are generated in `dist/`.

## License

MIT
