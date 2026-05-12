const MARK_TYPES = new Set([
  'point',
  'line',
  'interval',
  'pie',
  'area',
  'rect',
  'cell',
  'text'
])

const VIEW_TYPES = new Set(['row', 'col', 'layer', 'facet'])

const ENTER_PRESETS = new Set([
  'fade-in',
  'rise-in',
  'grow-y',
  'pop-in',
  'stagger-rise-in',
  'sweep-in',
  'draw-in'
])

const EASE_VALUES = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut'])

const GUIDE_POSITIONS = Object.freeze({
  x: new Set(['top', 'bottom']),
  y: new Set(['left', 'right']),
  color: new Set(['top', 'right', 'bottom', 'left'])
})

export class SparrowSpecValidationError extends Error {
  constructor(report, message = formatValidationReport(report)) {
    super(message)
    this.name = 'SparrowSpecValidationError'
    this.report = report
    this.errors = report?.errors || []
  }
}

export function validateSparrowSpec(input, options = {}) {
  const context = {
    errors: [],
    warnings: [],
    options: {
      allowViewChild: options.allowViewChild === true,
      allowInheritedData: options.allowInheritedData !== false
    }
  }

  validateRoot(input, '$', {
    ...context,
    inheritedData: undefined
  })

  return {
    valid: context.errors.length === 0,
    errors: context.errors,
    warnings: context.warnings
  }
}

export function assertValidSparrowSpec(input, options = {}) {
  const report = validateSparrowSpec(input, options)
  if (!report.valid) {
    throw new SparrowSpecValidationError(report)
  }
  return input
}

export function formatValidationReport(report) {
  const errors = Array.isArray(report?.errors) ? report.errors : []
  if (errors.length === 0) return 'Sparrow spec is valid.'

  const summary = errors
    .slice(0, 5)
    .map((error) => `${error.path}: ${error.message}`)
    .join('; ')
  const suffix = errors.length > 5 ? `; +${errors.length - 5} more` : ''
  return `Invalid Sparrow spec: ${summary}${suffix}`
}

function validateRoot(input, path, context) {
  if (!isPlainObject(input)) {
    addError(
      context,
      'root_object',
      path,
      'Sparrow spec must be a plain JSON object.'
    )
    return
  }

  validateGuides(input.guides, joinPath(path, 'guides'), context)
  validateAnimation(input.animation, joinPath(path, 'animation'), context)

  const inheritedData = Array.isArray(input.data)
    ? input.data
    : context.inheritedData

  if (input.view !== undefined) {
    validateViewNode(input.view, joinPath(path, 'view'), {
      ...context,
      inheritedData
    })
    return
  }

  if (isViewNode(input)) {
    validateViewNode(input, path, {
      ...context,
      inheritedData
    })
    return
  }

  if (isPlotLikeSpec(input)) {
    validatePlotLikeSpec(input, path, {
      ...context,
      inheritedData
    })
    return
  }

  if (
    input.type &&
    !MARK_TYPES.has(input.type) &&
    !VIEW_TYPES.has(input.type)
  ) {
    addError(
      context,
      'unsupported_type',
      joinPath(path, 'type'),
      `Unsupported Sparrow type "${input.type}".`
    )
    return
  }

  addError(
    context,
    'root_shape',
    path,
    'Use one root shape: plot, plots, view, or a direct supported mark spec.'
  )
}

function validateViewNode(node, path, context) {
  if (!isPlainObject(node)) {
    addError(context, 'view_object', path, 'View nodes must be objects.')
    return
  }

  if (!VIEW_TYPES.has(node.type)) {
    addError(
      context,
      'unsupported_view',
      joinPath(path, 'type'),
      `Unsupported view.type "${node.type}". Use row, col, layer, or facet.`
    )
  }

  const inheritedData = Array.isArray(node.data)
    ? node.data
    : context.inheritedData

  if (node.type === 'facet') {
    validateFacetNode(node, path, {
      ...context,
      inheritedData
    })
  }

  if (!Array.isArray(node.children) || node.children.length === 0) {
    addError(
      context,
      'view_children',
      joinPath(path, 'children'),
      'View nodes require a non-empty children array.'
    )
    return
  }

  node.children.forEach((child, index) => {
    validateViewChild(child, `${path}.children[${index}]`, {
      ...context,
      inheritedData
    })
  })
}

function validateFacetNode(node, path, context) {
  if (!Array.isArray(context.inheritedData)) {
    addError(
      context,
      'facet_data',
      joinPath(path, 'data'),
      'Facet views require data on the facet node or an inherited parent data array.'
    )
  }

  if (!node.facet?.by && !node.encodings?.x && !node.encodings?.y) {
    context.warnings.push({
      code: 'facet_grouping',
      path,
      message:
        'Facet views should declare facet.by or encodings.x/y so the runtime knows how to split panels.'
    })
  }
}

function validateViewChild(node, path, context) {
  if (!isPlainObject(node)) {
    addError(
      context,
      'view_child_object',
      path,
      'View children must be objects.'
    )
    return
  }

  if (node.view !== undefined) {
    addError(
      context,
      'nested_view_wrapped',
      joinPath(path, 'view'),
      'Nested views in view.children must be direct objects with type and children; do not wrap them in { "view": ... }.'
    )
    validateViewNode(node.view, joinPath(path, 'view'), context)
    return
  }

  if (isViewNode(node)) {
    validateViewNode(node, path, context)
    return
  }

  if (isPlotLikeSpec(node)) {
    validatePlotLikeSpec(node, path, context)
    return
  }

  addError(
    context,
    'view_child_shape',
    path,
    'View children must be nested views, plot specs, plots arrays, or direct supported mark specs.'
  )
}

function validatePlotLikeSpec(spec, path, context) {
  if (!isPlainObject(spec)) {
    addError(context, 'plot_spec_object', path, 'Plot specs must be objects.')
    return
  }

  validateGuides(spec.guides, joinPath(path, 'guides'), context)
  validateAnimation(spec.animation, joinPath(path, 'animation'), context)

  const inheritedData = Array.isArray(spec.data)
    ? spec.data
    : context.inheritedData

  if (spec.mark !== undefined) {
    addError(
      context,
      'mark_key',
      joinPath(path, 'mark'),
      'Use type for mark names. Do not use a separate mark key.'
    )
  }

  if (spec.plot !== undefined) {
    validatePlotField(spec.plot, joinPath(path, 'plot'), {
      ...context,
      inheritedData
    })
    return
  }

  if (spec.plots !== undefined) {
    if (!Array.isArray(spec.plots) || spec.plots.length === 0) {
      addError(
        context,
        'plots_array',
        joinPath(path, 'plots'),
        'plots must be a non-empty array of mark specs.'
      )
      return
    }

    spec.plots.forEach((plot, index) => {
      validateMarkSpec(plot, `${path}.plots[${index}]`, {
        ...context,
        inheritedData
      })
    })
    return
  }

  validateMarkSpec(spec, path, {
    ...context,
    inheritedData
  })
}

function validatePlotField(plot, path, context) {
  if (Array.isArray(plot)) {
    if (plot.length === 0) {
      addError(context, 'plot_array', path, 'plot arrays must not be empty.')
      return
    }

    plot.forEach((item, index) => {
      validateMarkSpec(item, `${path}[${index}]`, context)
    })
    return
  }

  validateMarkSpec(plot, path, context)
}

function validateMarkSpec(mark, path, context) {
  if (!isPlainObject(mark)) {
    addError(context, 'mark_object', path, 'Mark specs must be objects.')
    return
  }

  if (mark.mark !== undefined) {
    addError(
      context,
      'mark_key',
      joinPath(path, 'mark'),
      'Use type for mark names. Do not use plot.mark or a separate mark key.'
    )
  }

  if (!MARK_TYPES.has(mark.type)) {
    addError(
      context,
      'unsupported_mark',
      joinPath(path, 'type'),
      `Unsupported mark type "${mark.type}". Use point, line, interval, pie, area, rect, cell, or text.`
    )
  }

  validateMarkData(mark, path, context)
  validateEncodings(mark, path, context)
  validateGuides(mark.guides, joinPath(path, 'guides'), context)
  validateAnimation(mark.animation, joinPath(path, 'animation'), context)
}

function validateMarkData(mark, path, context) {
  if (mark.data !== undefined && !Array.isArray(mark.data)) {
    addError(
      context,
      'plot_data_array',
      joinPath(path, 'data'),
      'plot.data must be an array of plain JSON objects.'
    )
    return
  }

  if (
    !Array.isArray(mark.data) &&
    (!context.options.allowInheritedData ||
      !Array.isArray(context.inheritedData))
  ) {
    addError(
      context,
      'plot_data_required',
      joinPath(path, 'data'),
      'Leaf plot specs require data or an inherited parent data array.'
    )
  }
}

function validateEncodings(mark, path, context) {
  const encodings = mark.encodings || {}
  if (!isPlainObject(encodings)) {
    addError(
      context,
      'encodings_object',
      joinPath(path, 'encodings'),
      'encodings must be an object.'
    )
    return
  }

  if (mark.type === 'pie' && encodings.angle === undefined) {
    addError(
      context,
      'pie_angle_encoding',
      joinPath(path, 'encodings.angle'),
      'Pie charts must use encodings.angle for slice values.'
    )
  }
}

function validateGuides(guides, path, context) {
  if (guides === undefined || guides === true || guides === false) return
  if (!isPlainObject(guides)) {
    addError(
      context,
      'guides_object',
      path,
      'guides must be an object or false.'
    )
    return
  }

  for (const [channel, positions] of Object.entries(GUIDE_POSITIONS)) {
    const option = guides[channel]
    if (!isPlainObject(option) || option.position === undefined) continue
    if (!positions.has(option.position)) {
      addError(
        context,
        'guide_position',
        `${path}.${channel}.position`,
        `guides.${channel}.position cannot be "${option.position}".`
      )
    }
  }
}

function validateAnimation(animation, path, context) {
  if (animation === undefined || animation === null || animation === false)
    return
  if (typeof animation === 'string') {
    validateEnterPreset(animation, path, context)
    return
  }

  if (!isPlainObject(animation)) {
    addError(
      context,
      'animation_object',
      path,
      'animation must be a string or object.'
    )
    return
  }

  const enter = animation.enter === undefined ? animation : animation.enter
  validateEnterAnimation(enter, joinPath(path, 'enter'), context)
}

function validateEnterAnimation(enter, path, context) {
  if (typeof enter === 'string') {
    validateEnterPreset(enter, path, context)
    return
  }

  if (!isPlainObject(enter)) {
    addError(
      context,
      'animation_enter_object',
      path,
      'animation.enter must be a string or object.'
    )
    return
  }

  if (enter.type !== undefined) {
    addError(
      context,
      'animation_enter_type',
      joinPath(path, 'type'),
      'Use animation.enter.preset instead of animation.enter.type.'
    )
  }

  validateEnterPreset(enter.preset, joinPath(path, 'preset'), context)

  if (enter.ease !== undefined && !EASE_VALUES.has(enter.ease)) {
    addError(
      context,
      'animation_ease',
      joinPath(path, 'ease'),
      `Unsupported animation ease "${enter.ease}". Use linear, easeIn, easeOut, or easeInOut.`
    )
  }
}

function validateEnterPreset(preset, path, context) {
  if (preset === undefined) return
  if (!ENTER_PRESETS.has(preset)) {
    addError(
      context,
      'animation_preset',
      path,
      `Unsupported animation preset "${preset}".`
    )
  }
}

function isPlotLikeSpec(node) {
  return Boolean(
    isPlainObject(node) &&
    (node.plot !== undefined ||
      node.plots !== undefined ||
      MARK_TYPES.has(node.type))
  )
}

function isViewNode(node) {
  return Boolean(isPlainObject(node) && VIEW_TYPES.has(node.type))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function addError(context, code, path, message) {
  context.errors.push({ code, path, message })
}

function joinPath(base, key) {
  if (!base || base === '$') return `$.${key}`
  return `${base}.${key}`
}
