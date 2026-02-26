# Sparrow

轻量级 SVG 渲染与可视化基础库。核心是 `renderer`（SVG 画布与图形渲染），并包含比例尺、坐标系、几何通道、视图布局、指南与统计变换等模块。当前构建产物仅导出渲染器能力，其它模块仍在演进中。

## 特性
- SVG 渲染：`line`/`rect`/`circle`/`text`/`path`/`ring`
- 场景变换：`translate`/`rotate`/`scale` + 分组 `save`/`restore`
- 比例尺工具：线性/对数/时间/分位/分箱等（开发中）
- 视图布局：`layer`/`row`/`col`/`facet`（开发中）
- 测试：Vitest + jsdom + Playwright
- 构建：Vite 输出 ESM 与 UMD

## 快速开始
环境需求：Node.js ≥ 18，建议使用 pnpm。

```bash
pnpm install
pnpm dev            # 启动 Vite
pnpm test           # 单元测试 + 覆盖率
pnpm test:browser   # 浏览器测试（Playwright）
pnpm build          # 构建产物输出到 dist/
```

示例页面：
- `index.html`：基础图形 + 折线面积 + GUID 示例
- `renderer-test.html`：translate/rotate/scale 与 save/restore 变换演示

## 使用方式
当前未发布到 npm，推荐两种方式体验：

1) 开发态（Vite dev）：
```html
<script type="module">
  import { createRenderer } from '/src/renderer/renderer.js'
  const r = createRenderer(300, 200)
  r.rect({ x: 30, y: 30, width: 80, height: 50, fill: '#91d5ff' })
  document.body.appendChild(r.node())
</script>
```

2) 构建产物（dist）：
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

## Renderer API（核心）
创建：`createRenderer(width, height)`，返回渲染实例：

- 图形绘制
  - `line({ x1, y1, x2, y2, stroke, strokeWidth, ... })`
  - `rect({ x, y, width, height, ... })`（兼容负 `width/height`）
  - `circle({ cx, cy, r, ... })`
  - `text({ x, y, text, fontSize, textAnchor, ... })`
  - `path({ d, ... })`（`d` 支持二维数组 DSL）
  - `ring({ cx, cy, r1, r2, fill, stroke, strokeWidth })`

- 变换与分组
  - `translate` / `rotate` / `scale`
  - `save` / `restore`

- 访问器
  - `node()` 根 `<svg>` 节点
  - `group()` 当前 `<g>` 节点

## 目录结构
```
src/
  renderer/    # SVG 渲染核心
  scale/       # 比例尺与刻度
  coordinate/  # 坐标系
  geometry/    # 几何标记与通道
  plot/        # 高层语法与推断（演进中）
  views/       # 视图与布局（演进中）
  guid/        # 指南（轴/图例）
  statistc/    # 统计变换（bin/stack/normalize/symmetry）
  utils/       # 通用工具
test/          # Vitest 单测
```

## 测试与质量
- `pnpm test`：jsdom 环境单测
- `pnpm test:browser`：Playwright 浏览器用例
- 覆盖率输出在 `coverage/`

## 已知限制
- 构建仅打包 `renderer`，其它模块仍在打磨
- `guid`/`guide` 目录命名不一致，部分 import 需要统一
- `statistc` 目录名疑似拼写问题（后续可能调整）

## License
当前未附带 License，若需开源建议补充 MIT 等协议。
