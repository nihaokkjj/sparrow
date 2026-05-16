import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ragApi from '../../api/rag.js'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv }
  process.env.QDRANT_URL = 'https://qdrant.example'
  process.env.QDRANT_API_KEY = 'qdrant-key'
  process.env.OPENAI_EMBEDDING_API_KEY = 'embedding-key'
  process.env.OPENAI_EMBEDDING_BASE_URL = 'https://api.openai.com/v1'
  process.env.RAG_COLLECTION = 'sparrow_syntax'
  process.env.RAG_ALLOWED_ORIGINS = 'https://sparrow.example'
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
})

test('RAG API embeds the prompt and queries Qdrant', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      })
    )
    .mockResolvedValueOnce(
      Response.json({
        result: {
          points: [
            {
              id: 'point-1',
              score: 0.88,
              payload: {
                id: 'sparrow-rule-line',
                type: 'rule',
                title: 'Line charts',
                content: 'Use line for trends.',
                tags: ['line']
              }
            }
          ]
        }
      })
    )

  const response = await ragApi.fetch(
    createRAGRequest({ prompt: 'make a line chart', topK: 3 })
  )
  const payload = await response.json()

  expect(response.status).toBe(200)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
    'https://sparrow.example'
  )
  expect(payload.source).toBe('vector')
  expect(payload.matches[0].item.id).toBe('sparrow-rule-line')
  expect(globalThis.fetch).toHaveBeenNthCalledWith(
    1,
    'https://api.openai.com/v1/embeddings',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer embedding-key'
      })
    })
  )
  expect(globalThis.fetch).toHaveBeenNthCalledWith(
    2,
    'https://qdrant.example/collections/sparrow_syntax/points/query',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'api-key': 'qdrant-key'
      }),
      body: JSON.stringify({
        limit: 3,
        with_payload: true,
        with_vector: false,
        query: [0.1, 0.2, 0.3]
      })
    })
  )
})

test('RAG API falls back to legacy Qdrant search endpoint when query is unavailable', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({
        data: [{ embedding: [0.4, 0.5] }]
      })
    )
    .mockResolvedValueOnce(Response.json({ error: 'not found' }, { status: 404 }))
    .mockResolvedValueOnce(
      Response.json({
        result: [
          {
            id: 'point-2',
            score: 0.76,
            payload: {
              id: 'sparrow-rule-pie',
              title: 'Pie charts',
              content: 'Use pie for share.'
            }
          }
        ]
      })
    )

  const response = await ragApi.fetch(
    createRAGRequest({ prompt: 'make a pie chart' })
  )
  const payload = await response.json()

  expect(response.status).toBe(200)
  expect(payload.matches[0].item.id).toBe('sparrow-rule-pie')
  expect(String(globalThis.fetch.mock.calls[2][0])).toBe(
    'https://qdrant.example/collections/sparrow_syntax/points/search'
  )
})

test('RAG API returns an empty fallback-friendly result when unconfigured', async () => {
  delete process.env.QDRANT_URL
  vi.spyOn(globalThis, 'fetch')

  const response = await ragApi.fetch(
    createRAGRequest({ prompt: 'make a line chart' })
  )
  const payload = await response.json()

  expect(response.status).toBe(200)
  expect(payload).toEqual({
    matches: [],
    source: 'unconfigured',
    reason: 'QDRANT_URL is not configured.'
  })
  expect(globalThis.fetch).not.toHaveBeenCalled()
})

function createRAGRequest(body) {
  return new Request('https://sparrow.example/api/rag', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://sparrow.example'
    },
    body: JSON.stringify(body)
  })
}
