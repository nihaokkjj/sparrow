export const SPARROW_SYNTAX_KNOWLEDGE = Object.freeze([
  Object.freeze({
    id: 'sparrow-rule-json-only',
    type: 'rule',
    title: 'JSON-only output contract',
    content:
      'Return exactly one SparrowPlotSpec JSON object. Do not add prose, bullets, Markdown explanations, JavaScript callbacks, comments, or trailing commas outside the object.',
    tags: ['json', 'contract', 'output', 'format'],
    aliases: ['json only', '只输出', '格式'],
    priority: 10,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-root-shapes',
    type: 'rule',
    title: 'Root shapes',
    content:
      'Choose one root shape: use plot for one mark in one view, plots for layered marks that share scales, and view for separate panels or layouts.',
    tags: ['plot', 'plots', 'view', 'root', 'layout', 'layer'],
    aliases: ['单图', '组合图', '多图', '多面板', '布局'],
    priority: 10,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-supported-marks',
    type: 'rule',
    title: 'Supported marks',
    content:
      'Only use these mark types: point, line, interval, pie, area, rect, cell, and text. Do not use link, path, bar, scatter, heatmap, or any other unlisted mark type.',
    tags: [
      'mark',
      'type',
      'point',
      'line',
      'interval',
      'pie',
      'area',
      'rect',
      'cell',
      'text'
    ],
    aliases: [
      '图形',
      '点图',
      '折线图',
      '柱状图',
      '饼图',
      '面积图',
      '热力图',
      '文本'
    ],
    priority: 10,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-supported-views',
    type: 'rule',
    title: 'Supported views',
    content:
      'Only use these view.type values: row, col, layer, and facet. In view.children, nested views must be direct objects with type and children; do not wrap nested views inside an extra view object.',
    tags: ['view', 'row', 'col', 'layer', 'facet', 'children'],
    aliases: ['行布局', '列布局', '叠加', '分面', '子图'],
    priority: 10,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-direct-mark-type',
    type: 'negative-rule',
    title: 'Use type for mark names',
    content:
      'Write the mark name in type, such as plot.type, plots[].type, or a direct leaf spec.type. Do not use plot.mark or a separate mark key.',
    tags: ['negative', 'type', 'mark', 'plot.mark'],
    aliases: ['mark 字段', '类型字段'],
    priority: 9,
    source: 'src/plot/prompts.js'
  }),
  Object.freeze({
    id: 'sparrow-rule-data-arrays',
    type: 'rule',
    title: 'Leaf data arrays',
    content:
      'Leaf plot data must be an array of plain JSON objects. For view specs, shared data may live on the nearest common parent and child plots can inherit it.',
    tags: ['data', 'array', 'inherit', 'view', 'plot'],
    aliases: ['数据', '继承数据', '字段'],
    priority: 9,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-encodings',
    type: 'rule',
    title: 'Encoding channels',
    content:
      'Encodings map channels to field names or constants. Prefer x, y, angle, fill, stroke, r, and text. Keep channel names simple and consistent with the selected mark.',
    tags: [
      'encoding',
      'encodings',
      'x',
      'y',
      'angle',
      'fill',
      'stroke',
      'text'
    ],
    aliases: ['编码', '字段映射', '颜色', '半径', '文本'],
    priority: 8,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-layered-plots',
    type: 'rule',
    title: 'Layered marks in one panel',
    content:
      'Use plots when multiple marks should share the same scales and guides in one panel. Prefer plots over view.type = layer for a simple layered composition.',
    tags: ['plots', 'layer', 'line', 'area', 'shared scales'],
    aliases: ['叠加图', '组合图', '面积折线', '共享坐标轴'],
    priority: 8,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-multi-panel-layout',
    type: 'rule',
    title: 'Multi-panel layout',
    content:
      'Use view only when charts need separate layout regions. Use row or col for fixed side-by-side panels. For many panels without an explicit direction, prefer a near-square nested row/col layout.',
    tags: ['view', 'row', 'col', 'layout', 'multi-panel', 'dashboard'],
    aliases: ['多面板', '仪表盘', '看板', '并排', '网格'],
    priority: 8,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-facet-layout',
    type: 'rule',
    title: 'Facet layout',
    content:
      'Use facet when the same child chart should repeat over grouped data. Put the full dataset on the facet node, set facet.by to the grouping field, and let child plots inherit filtered data.',
    tags: ['facet', 'view', 'group', 'data', 'inherit', 'repeat'],
    aliases: ['分面', '按地区', '按类别', '分组', '重复图'],
    priority: 10,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-pie-charts',
    type: 'rule',
    title: 'Pie chart encoding',
    content:
      'For pie charts, use encodings.angle for slice values and fill for categories. Multiple independent pie charts should use view layouts instead of plots.',
    tags: ['pie', 'angle', 'fill', 'view', 'plots'],
    aliases: ['饼图', '占比', '份额', '多个饼图'],
    priority: 9,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-line-area-scales',
    type: 'rule',
    title: 'Ordered category lines and areas',
    content:
      'For ordered categories on a line or area chart, usually set scales.x.type to dot. For area charts, scales.y.zero is usually true.',
    tags: ['line', 'area', 'scale', 'scales.x.type', 'dot', 'zero'],
    aliases: ['折线图', '面积图', '趋势', '月份', '季度', '时间轴'],
    priority: 8,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-bar-scales',
    type: 'rule',
    title: 'Bar and column scales',
    content:
      'For bar or column charts, use the interval mark and usually set scales.y.zero to true so the quantitative axis starts at zero.',
    tags: ['interval', 'bar', 'column', 'scale', 'zero', 'scales.y.zero'],
    aliases: ['柱状图', '条形图', '分类对比', '销售额'],
    priority: 8,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-guides',
    type: 'rule',
    title: 'Guide positions',
    content:
      'Guide options may include position. guides.x.position can be top or bottom. guides.y.position can be left or right. guides.color.position can be top, right, bottom, or left.',
    tags: ['guide', 'guides', 'axis', 'legend', 'position', 'color'],
    aliases: ['坐标轴', '图例', '位置', '上方', '右侧'],
    priority: 7,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-animation',
    type: 'rule',
    title: 'Animation enter presets',
    content:
      'Animation is optional and belongs on leaf plot specs. animation.enter may be a preset string or an object with preset, duration, ease, delay, and stagger. Use preset, not type, inside animation.enter objects.',
    tags: ['animation', 'enter', 'preset', 'duration', 'ease', 'stagger'],
    aliases: ['动画', '入场动画', '生长动画'],
    priority: 7,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-animation-presets',
    type: 'rule',
    title: 'Animation preset choices',
    content:
      'Supported animation presets are fade-in, rise-in, grow-y, pop-in, stagger-rise-in, sweep-in, and draw-in. Use grow-y for interval, rect, cell, and area; pop-in for point; draw-in for line; sweep-in for pie; rise-in for text.',
    tags: [
      'animation',
      'fade-in',
      'rise-in',
      'grow-y',
      'pop-in',
      'sweep-in',
      'draw-in'
    ],
    aliases: ['动画效果', '柱状动画', '折线动画', '饼图动画'],
    priority: 7,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-rule-animation-ease',
    type: 'negative-rule',
    title: 'Animation ease values',
    content:
      'Supported ease values are linear, easeIn, easeOut, and easeInOut. Do not use kebab-case values such as ease-out, ease-in, or ease-in-out.',
    tags: ['animation', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'negative'],
    aliases: ['缓动', '动画曲线'],
    priority: 6,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-example-interval',
    type: 'example',
    title: 'Interval bar chart',
    content:
      '{"plot":{"type":"interval","data":[{"category":"A","value":12},{"category":"B","value":18}],"encodings":{"x":"category","y":"value"}},"scales":{"y":{"zero":true}}}',
    tags: ['example', 'interval', 'bar', 'category', 'scales.y.zero'],
    aliases: ['柱状图', '条形图', '分类对比'],
    priority: 6,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-example-line',
    type: 'example',
    title: 'Line trend chart',
    content:
      '{"plot":{"type":"line","data":[{"quarter":"Q1","value":12},{"quarter":"Q2","value":18}],"encodings":{"x":"quarter","y":"value"}},"scales":{"x":{"type":"dot"},"y":{"zero":true}}}',
    tags: ['example', 'line', 'trend', 'quarter', 'scales.x.type', 'dot'],
    aliases: ['折线图', '趋势', '季度', '月份'],
    priority: 6,
    source: 'test/plot/renderAISpec.test.js'
  }),
  Object.freeze({
    id: 'sparrow-example-area-line',
    type: 'example',
    title: 'Layered area and line chart',
    content:
      '{"plots":[{"type":"area","data":[{"month":"Jan","value":12},{"month":"Feb","value":18}],"encodings":{"x":"month","y":"value"}},{"type":"line","data":[{"month":"Jan","value":12},{"month":"Feb","value":18}],"encodings":{"x":"month","y":"value"}}],"scales":{"x":{"type":"dot"},"y":{"zero":true}}}',
    tags: ['example', 'plots', 'area', 'line', 'layered'],
    aliases: ['面积折线图', '叠加图', '趋势'],
    priority: 6,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-example-row-dashboard',
    type: 'example',
    title: 'Two-panel row layout',
    content:
      '{"width":900,"height":360,"view":{"type":"row","children":[{"plot":{"type":"interval","data":[{"category":"A","value":3}],"encodings":{"x":"category","y":"value"}}},{"plot":{"type":"line","data":[{"step":"Q1","value":2}],"encodings":{"x":"step","y":"value"}}}]}}',
    tags: ['example', 'view', 'row', 'dashboard', 'multi-panel'],
    aliases: ['多面板', '仪表盘', '并排'],
    priority: 6,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-example-facet-line',
    type: 'example',
    title: 'Facet line chart by group',
    content:
      '{"width":900,"height":360,"view":{"type":"facet","data":[{"region":"East","month":"Jan","sales":45},{"region":"East","month":"Feb","sales":52},{"region":"South","month":"Jan","sales":38},{"region":"South","month":"Feb","sales":41}],"facet":{"by":"region"},"children":[{"type":"line","encodings":{"x":"month","y":"sales"}}]}}',
    tags: ['example', 'facet', 'line', 'group', 'region', 'sales'],
    aliases: ['分面折线图', '按地区', '销售趋势'],
    priority: 7,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  }),
  Object.freeze({
    id: 'sparrow-example-pie',
    type: 'example',
    title: 'Pie chart',
    content:
      '{"plot":{"type":"pie","data":[{"category":"A","value":12},{"category":"B","value":18}],"encodings":{"angle":"value","fill":"category"}}}',
    tags: ['example', 'pie', 'angle', 'fill', 'share'],
    aliases: ['饼图', '占比', '份额'],
    priority: 6,
    source: 'test/plot/renderAISpec.test.js'
  }),
  Object.freeze({
    id: 'sparrow-negative-empty-placeholders',
    type: 'negative-rule',
    title: 'No fake placeholder marks',
    content:
      'Do not create empty text, point, rect, or other marks as layout placeholders. Use only real charts in the JSON; the runtime can handle spacing for incomplete rows.',
    tags: ['negative', 'placeholder', 'layout', 'text', 'empty'],
    aliases: ['占位', '空图', '空白'],
    priority: 8,
    source: 'skills/sparrow-spec-creator/references/prompt.md'
  })
])
