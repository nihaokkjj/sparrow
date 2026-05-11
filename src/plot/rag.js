import { DEFAULT_PLOT_SPEC_SYSTEM_PROMPT } from './prompts.js'
import { SPARROW_SYNTAX_KNOWLEDGE } from './ragKnowledge.js'

export { SPARROW_SYNTAX_KNOWLEDGE } from './ragKnowledge.js'

export const DEFAULT_SPARROW_RAG_TOP_K = 6
export const SPARROW_RAG_CONTEXT_MESSAGE_TITLE =
  'Relevant Sparrow syntax knowledge'

const CHINESE_QUERY_ALIASES = Object.freeze([
  ['分面', 'facet group repeat'],
  ['分组', 'group facet'],
  ['按地区', 'region facet group'],
  ['按类别', 'category facet group'],
  ['折线', 'line trend'],
  ['趋势', 'line area trend'],
  ['面积', 'area'],
  ['柱状', 'interval bar column'],
  ['条形', 'interval bar'],
  ['饼图', 'pie angle fill share'],
  ['占比', 'pie share'],
  ['份额', 'pie share'],
  ['散点', 'point scatter'],
  ['点图', 'point'],
  ['热力', 'cell rect heatmap'],
  ['文本', 'text'],
  ['多图', 'view row col multi-panel'],
  ['多面板', 'view row col multi-panel dashboard'],
  ['仪表盘', 'dashboard view row col'],
  ['看板', 'dashboard view row col'],
  ['并排', 'row col layout'],
  ['叠加', 'plots layer shared scales'],
  ['组合', 'plots layer'],
  ['图例', 'legend guide color'],
  ['坐标轴', 'axis guide'],
  ['动画', 'animation enter preset'],
  ['入场', 'animation enter'],
  ['布局', 'layout view row col'],
  ['数据', 'data fields'],
  ['颜色', 'fill stroke color'],
  ['季度', 'quarter dot scale'],
  ['月份', 'month dot scale']
])

const TOKEN_PATTERN = /[\p{Letter}\p{Number}_.-]+/gu

export function retrieveSparrowSyntaxKnowledge(
  query,
  {
    topK = DEFAULT_SPARROW_RAG_TOP_K,
    knowledge = SPARROW_SYNTAX_KNOWLEDGE
  } = {}
) {
  const queryTokens = createSearchTokens(query)
  const scored = knowledge
    .map((item, index) => ({
      item,
      index,
      matchedTokens: getMatchedTokens(item, queryTokens)
    }))
    .map((match) => ({
      ...match,
      score: scoreKnowledgeMatch(match)
    }))
    .filter((match) => match.score > 0)
    .sort(compareKnowledgeMatches)

  const matches =
    scored.length > 0
      ? scored
      : knowledge
          .map((item, index) => ({
            item,
            index,
            matchedTokens: [],
            score: Number(item.priority || 0)
          }))
          .sort(compareKnowledgeMatches)

  return matches.slice(0, Math.max(0, topK))
}

export function formatSparrowSyntaxContext(
  matches,
  { maxCharacters = 5000 } = {}
) {
  const lines = normalizeMatches(matches).map((match, index) => {
    const item = match.item
    const source = item.source ? ` Source: ${item.source}.` : ''
    return `${index + 1}. [${item.type}] ${item.title}: ${item.content}${source}`
  })

  return truncateContext(lines.join('\n'), maxCharacters)
}

export function createRAGPlotSpecMessages(
  prompt,
  {
    systemPrompt = DEFAULT_PLOT_SPEC_SYSTEM_PROMPT,
    topK = DEFAULT_SPARROW_RAG_TOP_K,
    knowledge = SPARROW_SYNTAX_KNOWLEDGE,
    maxContextCharacters = 5000
  } = {}
) {
  const matches = retrieveSparrowSyntaxKnowledge(prompt, { topK, knowledge })
  const context = formatSparrowSyntaxContext(matches, {
    maxCharacters: maxContextCharacters
  })

  if (!context) {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  }

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'system',
      content: [
        `${SPARROW_RAG_CONTEXT_MESSAGE_TITLE}:`,
        context,
        'Use this retrieved context only to choose valid SparrowPlotSpec JSON. If it conflicts with the main system prompt, follow the main system prompt.'
      ].join('\n')
    },
    { role: 'user', content: prompt }
  ]
}

export function createRAGPlotProvider(
  provider,
  {
    enabled = true,
    systemPrompt = DEFAULT_PLOT_SPEC_SYSTEM_PROMPT,
    topK = DEFAULT_SPARROW_RAG_TOP_K,
    knowledge = SPARROW_SYNTAX_KNOWLEDGE,
    maxContextCharacters = 5000
  } = {}
) {
  return {
    async stream(prompt, options = {}) {
      if (!enabled || options.messages) {
        return requestProviderStream(provider, prompt, options)
      }

      const messages = createRAGPlotSpecMessages(prompt, {
        systemPrompt: options.systemPrompt || systemPrompt,
        topK,
        knowledge,
        maxContextCharacters
      })

      return requestProviderStream(provider, prompt, {
        ...options,
        messages
      })
    }
  }
}

function requestProviderStream(provider, prompt, options) {
  if (!provider) {
    throw new Error('createRAGPlotProvider requires a provider.')
  }

  if (typeof provider === 'function') {
    return provider(prompt, options)
  }

  if (typeof provider.stream === 'function') {
    return provider.stream(prompt, options)
  }

  throw new Error('Provider must be a function or an object with stream().')
}

function normalizeMatches(matches) {
  return Array.isArray(matches)
    ? matches
        .map((match) => (match?.item ? match : { item: match }))
        .filter((match) => match.item)
    : []
}

function getMatchedTokens(item, queryTokens) {
  if (queryTokens.length === 0) return []

  const fields = getItemSearchFields(item)
  const exactTokens = new Set(createSearchTokens(fields.exact))
  const contentTokens = new Set(createSearchTokens(fields.content))

  return queryTokens.filter(
    (token) => exactTokens.has(token) || contentTokens.has(token)
  )
}

function scoreKnowledgeMatch({ item, matchedTokens }) {
  if (!matchedTokens.length) return 0

  const tags = new Set(createSearchTokens([item.tags, item.aliases].flat()))
  const title = new Set(createSearchTokens(item.title))
  const content = new Set(createSearchTokens(item.content))
  const matched = new Set(matchedTokens)
  let score = 0

  for (const token of matched) {
    if (tags.has(token)) score += 4
    if (title.has(token)) score += 3
    if (content.has(token)) score += 1
  }

  score += Number(item.priority || 0) * 0.2
  return score
}

function compareKnowledgeMatches(a, b) {
  if (b.score !== a.score) return b.score - a.score
  const priorityDelta =
    Number(b.item.priority || 0) - Number(a.item.priority || 0)
  if (priorityDelta !== 0) return priorityDelta
  return a.index - b.index
}

function getItemSearchFields(item) {
  return {
    exact: [item.title, item.tags, item.aliases].flat().filter(Boolean),
    content: [
      item.id,
      item.type,
      item.title,
      item.content,
      item.tags,
      item.aliases,
      item.source
    ]
      .flat()
      .filter(Boolean)
  }
}

function createSearchTokens(value) {
  const source = expandQueryAliases(flattenText(value).toLowerCase())
  const tokens = source.match(TOKEN_PATTERN) || []
  return [...new Set(tokens.filter((token) => token.length > 1))]
}

function expandQueryAliases(value) {
  let expanded = value
  for (const [pattern, alias] of CHINESE_QUERY_ALIASES) {
    if (expanded.includes(pattern)) {
      expanded += ` ${alias}`
    }
  }
  return expanded
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(' ')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object')
    return Object.values(value).map(flattenText).join(' ')
  return String(value)
}

function truncateContext(value, maxCharacters) {
  const text = String(value || '')
  if (!maxCharacters || text.length <= maxCharacters) return text
  return `${text.slice(0, Math.max(0, maxCharacters - 14)).trimEnd()}\n[truncated]`
}
