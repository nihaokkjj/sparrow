// src/renderer/renderer.js

import { createContext } from './context.js'
import { line, circle, text, rect, path, ring } from './shape.js'
import { translate, rotate, scale, save, restore } from './transform.js'
export function createRenderer(width, height) {
  const context = createContext(width, height) // 创建上下文信息
  return {
    line: (options) => line(context, options),
    circle: (options) => circle(context, options),
    text: (options) => text(context, options),
    rect: (options) => rect(context, options),
    path: (options) => path(context, options),
    ring: (options) => ring(context, options), // 绘制圆环
    translate: (tx, ty) => translate(context, tx, ty),
    rotate: (theta) => rotate(context, theta),
    scale: (sx, sy) => scale(context, sx, sy),
    save: () => save(context),
    restore: () => restore(context),
    node: () => context.node, // 下面会讲解
    group: () => context.group // 下面会讲解
  }
}
