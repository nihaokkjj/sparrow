# Sparrow · 轻量级 SVG 渲染与可视化基础库

> 说明：该仓库是一个用于学习/实践的可视化基础库，核心为基于 SVG 的渲染器（renderer），同时包含比例尺、坐标系、几何标记、视图/布局、指南（坐标轴/图例）、统计变换等模块。当前构建产物仅导出渲染器能力，其他模块仍在演进中。


## 特性
- 基于 SVG 的轻量渲染：`line`/`rect`/`circle`/`text`/`path`/`ring` 等基础图形
- 场景级变换：`translate`/`rotate`/`scale` + 分组 `save`/`restore`
- 比例尺与刻度：线性/对数/时间/分箱/分位等工具方法（开发中）
- 视图与布局：layer/row/col/facet 等视图布局（开发中）
- 单元测试完善：Vitest + jsdom（含部分浏览器端用例）
- Vite 构建：产出 ESM 与 UMD 两种格式


## 快速开始
- 环境需求：Node.js ≥ 18（CI 使用 22.x），建议使用 pnpm

```bash
pnpm install
pnpm dev            # 启动 Vite，本仓库根目录的 index.html/renderer-test.html 可直接预览
pnpm test           # 运行单元测试并生成覆盖率
pnpm test:browser   # 在浏览器环境执行部分用例（Playwright）
pnpm build          # 产物输出到 dist/（ESM + UMD）
```

- 预览示例
  - 演示页：`index.html` 展示基础绘制/折线+面积/基于 GUID 的示例
  - 变换演示：`renderer-test.html` 展示 translate/rotate/scale 与 save/restore


## 使用方式
当前包未发布到 npm，建议本地两种方式体验：

1) 直接从源码（开发态，Vite dev）：
```html
<script type="module">
  import { createRenderer } from '/src/renderer/renderer.js'
  const r = createRenderer(300, 200)
  r.rect({ x: 30, y: 30, width: 80, height: 50, fill: '#91d5ff' })
  document.body.appendChild(r.node())
</script>
```

2) 使用构建产物（生产态，本地文件或静态托管）：
- ESM：
```html
<script type="module">
  import { createRenderer } from './dist/sparrow.js'
  const r = createRenderer(300, 200)
  r.circle({ cx: 180, cy: 90, r: 35, fill: 'tomato' })
  document.body.appendChild(r.node())
</script>
```
- UMD（全局变量 `window.sparrow`）：
```html
<script src="./dist/sparrow.umd.cjs"></script>
<script>
  const r = window.sparrow.createRenderer(300, 200)
  r.text({ x: 150, y: 20, text: 'Hello Sparrow', fill: '#333', textAnchor: 'middle' })
  document.body.appendChild(r.node())
</script>
```


## Renderer API（当前主能力）
创建：`createRenderer(width, height)`，返回渲染上下文实例，常用方法：

- 图形绘制
  - `line({ x1, y1, x2, y2, stroke, strokeWidth, ... })`
  - `rect({ x, y, width, height, ... })`（已兼容负 `width/height`）
  - `circle({ cx, cy, r, ... })`
  - `text({ x, y, text, fontSize, textAnchor, ... })`
  - `path({ d, ... })`，`d` 支持二维数组，例如 `[['M',10,10], ['L',100,100], ['Z']]`
  - `ring({ cx, cy, r1, r2, fill, stroke, strokeWidth })`（通过三层圆模拟圆环）

- 变换与分组
  - `translate(tx, ty)` / `rotate(theta)` / `scale(sx, sy)`：对当前分组 `<g>` 追加 `transform`
  - `save()`：在当前 `<g>` 下创建子 `<g>` 并将其设为新的绘制分组
  - `restore()`：将当前分组回退至父 `<g>`（简易栈语义）

- 访问器
  - `node()`：返回根 `<svg>` 节点
  - `group()`：返回当前绘制分组 `<g>` 节点

示例（摘自 `index.html`）：
```js
const renderer = createRenderer(300, 200)
renderer.rect({ x: 30, y: 30, width: 80, height: 50, fill: '#91d5ff', stroke: '#096dd9' })
renderer.circle({ cx: 180, cy: 90, r: 35, fill: 'rgba(250,173,20,0.6)', stroke: '#d46b08' })
renderer.text({ x: 150, y: 190, text: '示例', fill: '#555', fontSize: 12, textAnchor: 'middle' })
document.getElementById('app')?.appendChild(renderer.node())
```


## 目录结构（要点）
- `src/renderer/`：渲染器实现（入口：`renderer.js`）
- `src/scale/`：比例尺与刻度工具（`linear/log/time/quantile/quantize/point/band/...`）
- `src/coordinate/`：坐标系统（`cartesian/transpose/polar`）
- `src/geometry/`：几何标记（如 `point`）与通道描述
- `src/plot/`：高层图形语法（编码/比例尺推断/指南推断）（开发中）
- `src/statistc/`：统计变换（分箱/堆叠/归一化/对称）（开发中）
- `src/views/`：视图与布局（layer/row/col/facet）（开发中）
- `test/`：Vitest 单测
- `index.html` / `renderer-test.html`：交互示例页面
- `vite.config.js`：构建配置（当前库入口仅 `src/renderer/renderer.js`）
- `dist/`：构建产物（`sparrow.js` ESM、`sparrow.umd.cjs` UMD）


## 测试与质量
- 测试：`pnpm test`（jsdom 环境）、`pnpm test:browser`（Playwright）
- 覆盖率：输出在 `coverage/`
- 规范：ESLint + Prettier；`pre-commit` 钩子会执行 `npm test`
- CI：GitHub Actions（`on: push/pull_request`）执行 `pnpm run ci`（先测后构建）


## 发布与版本
- 当前 `package.json` 标记 `private: true`，未发布到 npm
- 若需要发布：
  - 设置合理的包名与 `version`，移除 `private`
  - 评估导出入口（考虑从 `src/index.js` 汇总导出更多能力）
  - 补充 `README` 与变更日志、License


## 已知限制
- 构建仅打包 `renderer`，`plot/geometry/coordinate/scale` 等模块仍在打磨
- 目录/导入命名不一致：例如 `src/plot/create.js` 从 `../guide` 导入，但当前目录为 `src/guid/`，实际运行时可能报找不到模块，需统一为 `guide`
- 目录名 `statistc` 疑似拼写 `statistic`，后续可能调整（注意兼容）
- 仅支持现代浏览器（依赖 SVG 与 ES 模块）


## 许可协议
- 仓库未包含 License 文件，若需开源，建议新增 `MIT` 或其它适配协议


## 致谢与后续规划
- 计划补全高层图形语法（可组合的 `plot()` 流程：编码→比例尺→几何→坐标→指南）
- 完善示例与文档站、补充更多几何标记与交互能力
