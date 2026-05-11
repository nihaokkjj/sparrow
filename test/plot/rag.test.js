import { expect, test, vi } from 'vitest'
import {
  SPARROW_RAG_CONTEXT_MESSAGE_TITLE,
  createRAGPlotProvider,
  createRAGPlotSpecMessages,
  retrieveSparrowSyntaxKnowledge
} from '../../src/plot/index.js'

test('retrieveSparrowSyntaxKnowledge() finds facet and line rules for grouped trend requests', () => {
  const matches = retrieveSparrowSyntaxKnowledge(
    '做一个按地区分面的销售趋势折线图',
    { topK: 6 }
  )
  const ids = matches.map((match) => match.item.id)

  expect(ids).toContain('sparrow-rule-facet-layout')
  expect(ids).toEqual(
    expect.arrayContaining([expect.stringMatching(/line|facet/)])
  )
})

test('retrieveSparrowSyntaxKnowledge() finds pie layout guidance for multiple pie charts', () => {
  const matches = retrieveSparrowSyntaxKnowledge('生成多个饼图对比占比', {
    topK: 5
  })
  const text = matches.map((match) => match.item.content).join('\n')

  expect(matches.map((match) => match.item.id)).toContain(
    'sparrow-rule-pie-charts'
  )
  expect(text).toContain('Multiple independent pie charts should use view')
})

test('createRAGPlotSpecMessages() injects retrieved syntax context', () => {
  const messages = createRAGPlotSpecMessages('做一个柱状图', {
    systemPrompt: 'base system prompt',
    topK: 3
  })

  expect(messages).toHaveLength(3)
  expect(messages[0]).toEqual({
    role: 'system',
    content: 'base system prompt'
  })
  expect(messages[1].role).toBe('system')
  expect(messages[1].content).toContain(SPARROW_RAG_CONTEXT_MESSAGE_TITLE)
  expect(messages[1].content).toContain('interval')
  expect(messages[2]).toEqual({
    role: 'user',
    content: '做一个柱状图'
  })
})

test('createRAGPlotProvider() forwards enhanced messages to the wrapped provider', async () => {
  const stream = async function* () {
    yield '{"plot":{"type":"pie"}}'
  }
  const baseProvider = {
    stream: vi.fn(stream)
  }
  const provider = createRAGPlotProvider(baseProvider, {
    systemPrompt: 'base system prompt',
    topK: 4
  })

  const source = await provider.stream('生成多个饼图')

  expect(source[Symbol.asyncIterator]).toEqual(expect.any(Function))
  expect(baseProvider.stream).toHaveBeenCalledTimes(1)
  expect(baseProvider.stream.mock.calls[0][1].messages[0].content).toBe(
    'base system prompt'
  )
  expect(baseProvider.stream.mock.calls[0][1].messages[1].content).toContain(
    'pie'
  )
})

test('createRAGPlotProvider() preserves explicit messages', async () => {
  const customMessages = [{ role: 'user', content: 'custom' }]
  const baseProvider = {
    stream: vi.fn(async function* () {
      yield '{}'
    })
  }
  const provider = createRAGPlotProvider(baseProvider)

  await provider.stream('做一个折线图', { messages: customMessages })

  expect(baseProvider.stream.mock.calls[0][1].messages).toBe(customMessages)
})
