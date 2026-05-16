import { afterEach, expect, test, vi } from 'vitest'
import {
  normalizeVectorRAGMatches,
  retrieveVectorSparrowSyntaxKnowledge
} from '../../src/plot/vectorRagClient.js'

afterEach(() => {
  vi.restoreAllMocks()
})

test('retrieveVectorSparrowSyntaxKnowledge() posts prompt and returns matches', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      matches: [
        {
          item: {
            id: 'rule-line',
            type: 'rule',
            title: 'Line charts',
            content: 'Use line for trends.'
          },
          score: 0.87
        }
      ],
      source: 'vector'
    })
  )

  const signal = new AbortController().signal
  const matches = await retrieveVectorSparrowSyntaxKnowledge('line trend', {
    endpoint: '/api/rag',
    topK: 3,
    filters: { must: [] },
    signal
  })

  expect(matches).toHaveLength(1)
  expect(matches[0].item.id).toBe('rule-line')
  expect(globalThis.fetch).toHaveBeenCalledWith(
    '/api/rag',
    expect.objectContaining({
      method: 'POST',
      signal,
      body: JSON.stringify({
        prompt: 'line trend',
        topK: 3,
        filters: { must: [] }
      })
    })
  )
})

test('retrieveVectorSparrowSyntaxKnowledge() throws API errors', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ error: 'Qdrant unavailable' }, { status: 502 })
  )

  await expect(
    retrieveVectorSparrowSyntaxKnowledge('line trend')
  ).rejects.toThrow('Qdrant unavailable')
})

test('normalizeVectorRAGMatches() accepts raw item arrays', () => {
  expect(
    normalizeVectorRAGMatches([
      {
        id: 'raw-rule',
        title: 'Raw rule',
        content: 'Raw item content.'
      },
      null
    ])
  ).toEqual([
    {
      item: {
        id: 'raw-rule',
        title: 'Raw rule',
        content: 'Raw item content.'
      }
    }
  ])
})
