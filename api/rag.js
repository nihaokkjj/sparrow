import { DEFAULT_OPENAI_BASE_URL } from '../src/plot/providerConfig.js'

const DEFAULT_RAG_COLLECTION = 'sparrow_syntax'
const DEFAULT_RAG_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_RAG_TOP_K = 6
const DEFAULT_RAG_MAX_TOP_K = 20
const DEFAULT_RAG_MAX_PROMPT_CHARACTERS = 8000

export const config = {
  maxDuration: 60
}

export default {
  async fetch(request) {
    const corsOptions = resolveCorsOptions(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: corsOptions.allowed ? 204 : 403,
        headers: corsHeaders(corsOptions)
      })
    }

    if (!corsOptions.allowed) {
      return jsonError('Origin is not allowed.', 403, corsOptions)
    }

    if (String(request.method || 'GET').toUpperCase() !== 'POST') {
      return jsonError('Only POST is supported.', 405, corsOptions, {
        Allow: 'POST, OPTIONS'
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return jsonError('Request body must be JSON.', 400, corsOptions)
    }

    const prompt = String(body?.prompt || '').trim()
    if (!prompt) {
      return jsonError('prompt is required.', 400, corsOptions)
    }

    const ragConfig = resolveRAGConfig()
    if (!ragConfig.configured) {
      return jsonResponse(
        {
          matches: [],
          source: 'unconfigured',
          reason: ragConfig.reason
        },
        200,
        corsOptions
      )
    }

    const topK = normalizeTopK(body?.topK)
    const filters = isPlainObject(body?.filters) ? body.filters : undefined

    try {
      const embedding = await createEmbedding(
        prompt.slice(0, ragConfig.maxPromptCharacters),
        ragConfig,
        request.signal
      )
      const matches = await queryQdrant(
        embedding,
        { topK, filters },
        ragConfig,
        request.signal
      )

      return jsonResponse(
        {
          matches,
          source: 'vector',
          collection: ragConfig.collection
        },
        200,
        corsOptions
      )
    } catch (error) {
      return jsonError(
        error?.message || 'Vector RAG retrieval failed.',
        502,
        corsOptions
      )
    }
  }
}

function resolveRAGConfig() {
  const qdrantURL = normalizeURL(process.env.QDRANT_URL)
  const embeddingBaseURL = normalizeURL(
    process.env.OPENAI_EMBEDDING_BASE_URL || DEFAULT_OPENAI_BASE_URL
  )
  const embeddingAPIKey =
    String(
      process.env.OPENAI_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || ''
    ).trim() || ''

  if (!qdrantURL) {
    return {
      configured: false,
      reason: 'QDRANT_URL is not configured.'
    }
  }

  if (!embeddingAPIKey) {
    return {
      configured: false,
      reason: 'OPENAI_API_KEY or OPENAI_EMBEDDING_API_KEY is not configured.'
    }
  }

  return {
    configured: true,
    qdrantURL,
    qdrantAPIKey: String(process.env.QDRANT_API_KEY || '').trim(),
    collection:
      String(process.env.RAG_COLLECTION || DEFAULT_RAG_COLLECTION).trim() ||
      DEFAULT_RAG_COLLECTION,
    embeddingBaseURL,
    embeddingAPIKey,
    embeddingModel:
      String(
        process.env.RAG_EMBEDDING_MODEL || DEFAULT_RAG_EMBEDDING_MODEL
      ).trim() || DEFAULT_RAG_EMBEDDING_MODEL,
    maxPromptCharacters: readPositiveInteger(
      process.env.RAG_MAX_PROMPT_CHARACTERS,
      DEFAULT_RAG_MAX_PROMPT_CHARACTERS
    )
  }
}

async function createEmbedding(input, ragConfig, signal) {
  const response = await fetch(buildEmbeddingURL(ragConfig.embeddingBaseURL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ragConfig.embeddingAPIKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: ragConfig.embeddingModel,
      input
    }),
    signal
  })

  const payload = await readJSONResponse(response)
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.error ||
        `Embedding request failed with ${response.status}.`
    )
  }

  const embedding = payload?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Embedding response did not include a vector.')
  }

  return embedding
}

async function queryQdrant(vector, { topK, filters }, ragConfig, signal) {
  const queryBody = createQdrantQueryBody({
    query: vector,
    topK,
    filters
  })
  const queryURL = buildQdrantCollectionURL(
    ragConfig,
    `/points/query`
  )
  const queryResponse = await requestQdrant(queryURL, queryBody, ragConfig, {
    signal
  })

  if (queryResponse.ok) {
    return normalizeQdrantMatches(queryResponse.payload)
  }

  if (![400, 404, 405].includes(queryResponse.status)) {
    throw new Error(queryResponse.error)
  }

  const searchBody = createQdrantQueryBody({
    vector,
    topK,
    filters
  })
  const searchURL = buildQdrantCollectionURL(
    ragConfig,
    `/points/search`
  )
  const searchResponse = await requestQdrant(searchURL, searchBody, ragConfig, {
    signal
  })

  if (!searchResponse.ok) {
    throw new Error(searchResponse.error)
  }

  return normalizeQdrantMatches(searchResponse.payload)
}

async function requestQdrant(url, body, ragConfig, { signal } = {}) {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (ragConfig.qdrantAPIKey) {
    headers['api-key'] = ragConfig.qdrantAPIKey
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })
  const payload = await readJSONResponse(response)

  return {
    ok: response.ok,
    status: response.status,
    payload,
    error:
      payload?.status?.error ||
      payload?.error ||
      `Qdrant request failed with ${response.status}.`
  }
}

function createQdrantQueryBody({ query, vector, topK, filters }) {
  const body = {
    limit: topK,
    with_payload: true,
    with_vector: false
  }

  if (query) body.query = query
  if (vector) body.vector = vector
  if (filters) body.filter = filters
  return body
}

function normalizeQdrantMatches(payload) {
  const points = Array.isArray(payload?.result)
    ? payload.result
    : Array.isArray(payload?.result?.points)
      ? payload.result.points
      : []

  return points
    .map((point) => {
      const item = normalizeQdrantPayload(point?.payload, point?.id)
      if (!item) return null
      return {
        item,
        score: typeof point.score === 'number' ? point.score : undefined,
        source: 'vector'
      }
    })
    .filter(Boolean)
}

function normalizeQdrantPayload(payload, fallbackId) {
  const source = isPlainObject(payload?.item) ? payload.item : payload
  if (!isPlainObject(source)) return null

  const content = String(source.content || source.text || '').trim()
  const title = String(source.title || source.id || fallbackId || '').trim()
  if (!content && !title) return null

  return {
    id: String(source.id || fallbackId || title).trim(),
    type: String(source.type || 'reference').trim(),
    title,
    content,
    tags: normalizeStringArray(source.tags),
    aliases: normalizeStringArray(source.aliases),
    priority: Number(source.priority || 0),
    source: String(source.source || '').trim()
  }
}

function buildEmbeddingURL(baseURL) {
  return new URL(
    'embeddings',
    baseURL.endsWith('/') ? baseURL : `${baseURL}/`
  ).toString()
}

function buildQdrantCollectionURL(ragConfig, suffix) {
  return new URL(
    `collections/${encodeURIComponent(ragConfig.collection)}${suffix}`,
    ragConfig.qdrantURL.endsWith('/')
      ? ragConfig.qdrantURL
      : `${ragConfig.qdrantURL}/`
  ).toString()
}

function resolveCorsOptions(request) {
  const allowedOrigins = String(
    process.env.RAG_ALLOWED_ORIGINS || process.env.OPENAI_PROXY_ALLOWED_ORIGINS || ''
  )
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  if (allowedOrigins.length === 0) {
    return {
      allowed: true,
      origin: request.headers.get('origin') || '*'
    }
  }

  const origin = request.headers.get('origin')
  return {
    allowed: Boolean(origin && allowedOrigins.includes(origin)),
    origin
  }
}

function corsHeaders({ allowed, origin } = {}) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  }

  if (allowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

function jsonResponse(body, status, corsOptions, extraHeaders) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(corsOptions),
      ...extraHeaders
    }
  })
}

function jsonError(message, status, corsOptions, extraHeaders) {
  return jsonResponse({ error: message }, status, corsOptions, extraHeaders)
}

async function readJSONResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeURL(value) {
  const normalized = String(value || '').trim()
  return normalized ? normalized.replace(/\/+$/, '') : ''
}

function normalizeTopK(value) {
  const topK = Number.parseInt(value, 10)
  if (!Number.isFinite(topK)) return DEFAULT_RAG_TOP_K
  return Math.max(1, Math.min(topK, DEFAULT_RAG_MAX_TOP_K))
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : fallback
}
