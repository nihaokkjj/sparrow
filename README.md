# Sparrow

Sparrow 是一个轻量级 SVG 可视化项目，既可以作为底层图形渲染器使用，也可以通过声明式 `SparrowPlotSpec` 快速生成图表。项目还内置了 AI Playground：输入自然语言，接收模型流式输出的 JSON 图表规格，并实时渲染为 SVG。

它适合这些场景：

- 在 Web 页面中直接绘制 SVG 图形、图表和信息可视化。
- 用简洁 JSON 描述柱状图、折线图、散点图、饼图、面积图、热力图等常见图表。
- 将大模型输出约束为稳定的图表规格，再渲染成可控、可测试、可导出的 SVG。
- 在自己的项目里复用坐标系、比例尺、统计变换、轴、图例、多视图布局等基础能力。

## 项目亮点

- **SVG-first**：核心输出是标准 SVG 元素，易于挂载到 DOM、截图、导出和二次处理。
- **轻量模块化**：核心渲染器、坐标系、比例尺、统计变换、图表语法、引导组件和视图布局相互独立。
- **声明式图表规格**：用 `SparrowPlotSpec` 描述数据、编码、比例尺、坐标系、图例、动画和布局。
- **AI 友好**：内置模型提示词、JSON 流式解析、Mock Provider、OpenAI-compatible Provider 和浏览器 Playground。
- **多图布局能力**：支持 `row`、`col`、`layer`、`facet`，并能自动把拥挤的长条多面板布局平衡成近似网格。
- **动画与导出**：支持常用入场动画预设，并在 Playground 中提供 PNG 导出。
- **多格式产物**：构建输出 ESM、CommonJS 和 UMD，方便在不同工程中接入。

## 快速开始

### 安装

```bash
npm install @ksj_sparrow/sparrow
```

或：

```bash
pnpm add @ksj_sparrow/sparrow
```

### 本地运行 Playground

```bash
pnpm install
pnpm dev
```

启动后打开 Vite 提供的本地地址，访问 `/` 即可使用 AI Playground。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务和 AI Playground |
| `pnpm build` | 构建库产物到 `dist/` |
| `pnpm build:site` | 构建站点到 `site-dist/` |
| `pnpm preview:site` | 预览构建后的站点 |
| `pnpm test` | 运行单元测试和覆盖率 |
| `pnpm ci` | 依次运行测试和构建 |

## 使用方式

### 1. 使用底层 SVG Renderer

如果你只需要直接绘制 SVG，可以从根入口导入 `createRenderer`。

```js
import { createRenderer } from '@ksj_sparrow/sparrow'

const renderer = createRenderer(420, 240)

renderer.rect({
  x: 32,
  y: 32,
  width: 150,
  height: 84,
  fill: '#dbeafe',
  stroke: '#2563eb',
  strokeWidth: 2
})

renderer.circle({
  cx: 290,
  cy: 74,
  r: 36,
  fill: '#fde68a',
  stroke: '#d97706',
  strokeWidth: 2
})

renderer.line({
  x1: 48,
  y1: 176,
  x2: 360,
  y2: 138,
  stroke: '#7c3aed',
  strokeWidth: 3
})

renderer.text({
  x: 210,
  y: 218,
  text: 'Hello Sparrow',
  textAnchor: 'middle',
  fill: '#0f172a',
  fontSize: 18
})

document.querySelector('#app').appendChild(renderer.node())
```

Renderer 当前提供：

- 基础图形：`line()`、`rect()`、`circle()`、`text()`、`path()`、`ring()`。
- 变换能力：`translate()`、`rotate()`、`scale()`、`save()`、`restore()`。
- 动画能力：`animate()`、`tween()`、`sequence()`、`stagger()`。
- DOM 输出：`node()` 返回根 `<svg>`，`group()` 返回当前 `<g>`。

### 2. 使用 Plot Spec 渲染图表

如果你希望用数据和编码描述图表，可以使用 `@ksj_sparrow/sparrow/plot`。

```js
import { renderPlotSpec } from '@ksj_sparrow/sparrow/plot'

const result = renderPlotSpec({
  width: 640,
  height: 420,
  container: '#app',
  data: [
    { quarter: 'Q1', value: 12 },
    { quarter: 'Q2', value: 18 },
    { quarter: 'Q3', value: 15 },
    { quarter: 'Q4', value: 24 }
  ],
  plots: [
    {
      type: 'line',
      encodings: { x: 'quarter', y: 'value' },
      styles: { stroke: '#2563eb', strokeWidth: 3 },
      animation: { enter: 'draw-in' }
    },
    {
      type: 'point',
      encodings: { x: 'quarter', y: 'value' },
      styles: { fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 },
      animation: { enter: 'pop-in' }
    }
  ],
  scales: {
    x: { type: 'dot' },
    y: { zero: true }
  },
  guides: {
    x: { label: 'Quarter' },
    y: { label: 'Value', grid: true }
  }
})

console.log(result.node)
```

`renderPlotSpec()` 会返回渲染结果对象，常用字段包括：

- `node`：生成的 SVG 节点。
- `marks`：图表主体图形节点。
- `scales` / `scaleDescriptors`：比例尺实例和描述信息。
- `guideDescriptors`：坐标轴、网格、图例等引导信息。
- `playAnimations()` / `stopAnimations()`：手动播放或停止入场动画。

### 3. 使用 AI Playground / 自然语言生成图表

项目内置了从自然语言到图表的最小链路：

```txt
Prompt -> Provider -> 流式文本 -> SparrowPlotSpec JSON -> SVG
```

你可以先用 Mock Provider 验证完整流程：

```js
import {
  createMockPlotProvider,
  streamPlotSpec
} from '@ksj_sparrow/sparrow/plot'

await streamPlotSpec({
  prompt: 'Create a quarterly trend line chart from Q1 to Q4',
  provider: createMockPlotProvider({ delay: 0 }),
  renderOptions: {
    container: '#app'
  },
  onChunk(chunk) {
    console.log('chunk:', chunk)
  },
  onSpec(spec) {
    console.log('valid spec:', spec)
  }
})
```

### 4. 接入 OpenAI-compatible 模型

Playground 支持两种连接方式：

- **Same-origin proxy**：浏览器请求本地 Vite 代理，由代理转发到 OpenAI 或其他兼容接口，推荐用于避免 CORS。
- **Direct / relay URL**：浏览器直接请求目标地址，目标服务需要允许 CORS。

如果使用本地代理，在项目根目录创建 `.env.local`：

```bash
OPENAI_PROXY_TARGET=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
```

也可以把代理指向自己的中转服务：

```bash
OPENAI_PROXY_TARGET=http://localhost:3001/v1
```

然后运行：

```bash
pnpm dev
```

在 Playground 中选择 `OpenAI-compatible`，填写模型名称和连接方式即可。项目默认代理路径为 `/api/openai`。

在代码中也可以直接组装 Provider：

```js
import {
  buildProviderRequestConfig,
  createOpenAICompatibleProvider,
  streamPlotSpec
} from '@ksj_sparrow/sparrow/plot'

const requestConfig = buildProviderRequestConfig({
  connectionMode: 'proxy',
  targetBaseURL: 'https://api.openai.com/v1'
})

const provider = createOpenAICompatibleProvider({
  baseURL: requestConfig.baseURL,
  headers: requestConfig.headers,
  model: 'gpt-4o-mini'
})

await streamPlotSpec({
  prompt: 'Create a bar chart of sales by region',
  provider,
  renderOptions: { container: '#app' }
})
```

## SparrowPlotSpec 速览

`SparrowPlotSpec` 是项目的高层图表 JSON 格式。它有三种常见写法。

### 单图

```json
{
  "width": 480,
  "height": 320,
  "plot": {
    "type": "interval",
    "data": [
      { "category": "A", "value": 12 },
      { "category": "B", "value": 18 }
    ],
    "encodings": {
      "x": "category",
      "y": "value"
    },
    "styles": {
      "fill": "#5b6df6"
    }
  },
  "guides": {
    "x": { "label": "Category" },
    "y": { "label": "Value", "grid": true }
  }
}
```

### 多图层

多个 mark 共享数据、比例尺和引导组件时，使用 `plots`：

```json
{
  "width": 640,
  "height": 360,
  "data": [
    { "month": "Jan", "value": 10 },
    { "month": "Feb", "value": 16 },
    { "month": "Mar", "value": 13 }
  ],
  "plots": [
    {
      "type": "line",
      "encodings": { "x": "month", "y": "value" }
    },
    {
      "type": "point",
      "encodings": { "x": "month", "y": "value" }
    }
  ],
  "scales": {
    "x": { "type": "dot" },
    "y": { "zero": true }
  }
}
```

### 多视图

多个独立图表面板使用 `view`：

```json
{
  "width": 900,
  "height": 420,
  "view": {
    "type": "row",
    "padding": 24,
    "children": [
      {
        "plot": {
          "type": "interval",
          "data": [
            { "category": "A", "value": 12 },
            { "category": "B", "value": 18 }
          ],
          "encodings": { "x": "category", "y": "value" }
        }
      },
      {
        "plot": {
          "type": "pie",
          "data": [
            { "name": "Desktop", "value": 55 },
            { "name": "Mobile", "value": 45 }
          ],
          "encodings": { "angle": "value", "fill": "name" }
        }
      }
    ]
  }
}
```

### 支持的图表能力

- **Mark 类型**：`point`、`line`、`interval`、`pie`、`area`、`rect`、`cell`、`text`。
- **编码字段**：常用 `x`、`y`、`x1`、`y1`、`fill`、`stroke`、`r`、`text`、`angle` 等。
- **比例尺**：`linear`、`log`、`time`、`band`、`dot`、`ordinal`、`identity`、`quantile`、`quantize`、`threshold`。
- **坐标系**：`cartesian`、`polar`、`transpose`，饼图会默认使用极坐标。
- **引导组件**：`axisX`、`axisY`、`legendRamp`、`legendSwatches`，可通过 `guides` 控制显示、位置、标签和网格。
- **统计变换**：`binX`、`stackY`、`normalizeY`、`symmetryY`。
- **视图布局**：`row`、`col`、`layer`、`facet`。
- **动画预设**：`fade-in`、`rise-in`、`grow-y`、`pop-in`、`stagger-rise-in`、`sweep-in`、`draw-in`。

## 公开 API

### 根入口

```js
import {
  createRenderer,
  createCoordinate,
  cartesian,
  polar,
  transpose,
  createLinear,
  createIdentity,
  createOrdinal,
  createBand,
  createPoint,
  createQuantile,
  createThreshold,
  createQuantize,
  createTime,
  createLog,
  interpolateNumber,
  interpolateColor,
  createBinX,
  createNormalizeY,
  createStackY,
  createSymmetryY
} from '@ksj_sparrow/sparrow'
```

### Plot 入口

```js
import {
  create,
  register,
  initialize,
  inferGuides,
  inferScales,
  applyScales,
  renderPlotSpec,
  renderAISpec,
  streamPlotSpec,
  createMockPlotProvider,
  createOpenAICompatibleProvider,
  createPlotSpecChunkBuffer,
  parsePlotSpecResponse,
  buildProviderRequestConfig,
  getPlotSpecPromptPreset,
  listPlotSpecPromptPresets
} from '@ksj_sparrow/sparrow/plot'
```

### Guide 入口

```js
import {
  axisX,
  axisY,
  legendRamp,
  legendSwatches
} from '@ksj_sparrow/sparrow/guide'
```

### Views 入口

```js
import { createViews } from '@ksj_sparrow/sparrow/views'
```

## Playground 功能

当前 Playground 位于项目首页，主要提供：

- Prompt 输入和图表尺寸配置。
- `Mock provider` 与 `OpenAI-compatible` 两种 Provider。
- `Same-origin proxy` 与 `Direct / relay URL` 两种连接模式。
- Prompt preset / Skill mode 选择，默认使用仓库内 `sparrow-spec-creator` 规格提示词。
- 自动布局开关，用于控制多面板图表是否自动平衡。
- 流式输出查看、实时 JSON 解析、SVG 预览。
- 重新渲染、停止动画、导出 PNG。

## 目录结构

```txt
src/
  renderer/      SVG 渲染器、图形、变换和动画
  coordinate/    笛卡尔、极坐标、转置等坐标变换
  scale/         连续、离散、时间、分位等比例尺
  statistic/     bin、stack、normalize、symmetry 等统计变换
  geometry/      point、line、interval、pie、area 等图元
  guide/         坐标轴、网格、图例
  views/         row、col、layer、facet 视图布局
  plot/          声明式图表语法、AI 规格渲染和 Playground Provider
  playground/    Playground 辅助能力，例如 PNG 导出
skills/
  sparrow-spec-creator/       面向模型生成图表规格的 Skill
  sparrow-core-contributor/   面向项目开发维护的 Skill
test/
  */                           单元测试、图表渲染测试和公开入口测试
```

## 开发说明

环境要求：

- Node.js `>=18`
- 推荐使用 pnpm

安装依赖：

```bash
pnpm install
```

运行测试：

```bash
pnpm test
```

构建库：

```bash
pnpm build
```

构建站点：

```bash
pnpm build:site
```

## 常见问题

### 模型输出不是合法 JSON 怎么办？

`streamPlotSpec()` 内部使用 `createPlotSpecChunkBuffer()` 增量解析 JSON。Provider 最终必须输出一个合法的 `SparrowPlotSpec` 对象，最好只返回 JSON，或只包一层 `json` 代码块。

### 浏览器直连接口遇到 CORS 怎么办？

推荐使用 `Same-origin proxy`。配置 `.env.local` 中的 `OPENAI_PROXY_TARGET` 和 `OPENAI_API_KEY`，让本地 Vite 代理负责转发请求。

### 多个面板太挤怎么办？

`renderAISpec()` 默认会自动平衡扁平的 `row` / `col` 多面板布局。你也可以通过 `autoLayout: false` 关闭：

```js
renderAISpec(spec, { autoLayout: false })
```

### 动画没有播放怎么办？

如果 SVG 渲染时还没有挂载到 DOM，入场动画不会自动播放。可以先挂载 `result.node`，再手动调用：

```js
result.playAnimations()
```

## License

MIT
