import { createHash } from 'node:crypto'
import { DEFAULT_OPENAI_BASE_URL } from '../src/plot/providerConfig.js'
import { SPARROW_SYNTAX_KNOWLEDGE } from '../src/plot/ragKnowledge.js'

const DEFAULT_RAG_COLLECTION = 'sparrow_syntax'
const DEFAULT_RAG_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_RAG_VECTOR_SIZE = 1536
const DEFAULT_BATCH_SIZE = 64

async function main() {
  const config = resolveConfig()
  await ensureCollection(config)

  const points = []
  for (const [index, item] of SPARROW_SYNTAX_KNOWLEDGE.entries()) {
    const input = createEmbeddingInput(item)
    const vector = await createEmbedding(input, config)
    points.push({
      id: createStableUUID(item.id || `${index}`),
      vector,
      payload: createPayload(item, input)
    })

    console.log(`Embedded ${index + 1}/${SPARROW_SYNTAX_KNOWLEDGE.length}: ${item.id}`)
  }

  for (let index = 0; index < points.length; index += config.batchSize) {
    const batch = points.slice(index, index + config.batchSize)
    await upsertPoints(batch, config)
    console.log(`Upserted ${Math.min(index + batch.length, points.length)}/${points.length}`)
  }

  console.log(`RAG index ready: ${config.collection}`)
}

function resolveConfig() {
  const qdrantURL = normalizeURL(process.env.QDRANT_URL)
  const embeddingBaseURL = normalizeURL(
    process.env.OPENAI_EMBEDDING_BASE_URL || DEFAULT_OPENAI_BASE_URL
  )
  const embeddingAPIKey =
    String(
      process.env.OPENAI_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || ''
    ).trim() || ''

  if (!qdrantURL) {
    throw new Error('QDRANT_URL is required.')
  }

  if (!embeddingAPIKey) {
    throw new Error('OPENAI_API_KEY or OPENAI_EMBEDDING_API_KEY is required.')
  }

  return {
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
    vectorSize: readPositiveInteger(
      process.env.RAG_VECTOR_SIZE,
      DEFAULT_RAG_VECTOR_SIZE
    ),
    batchSize: readPositiveInteger(process.env.RAG_BATCH_SIZE, DEFAULT_BATCH_SIZE)
  }
}

async function ensureCollection(config) {
  const response = await fetch(buildQdrantURL(config, `collections/${config.collection}`), {
    method: 'PUT',
    headers: createQdrantHeaders(config),
    body: JSON.stringify({
      vectors: {
        size: config.vectorSize,
        distance: 'Cosine'
      }
    })
  })

  if (!response.ok) {
    const error = await readError(response)
    throw new Error(`Failed to create Qdrant collection: ${error}`)
  }
}

async function createEmbedding(input, config) {
  const response = await fetch(buildEmbeddingURL(config.embeddingBaseURL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.embeddingAPIKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input
    })
  })

  const payload = await readJSONResponse(response)
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.error ||
        `Embedding request failed with ${response.status}.`
    )
  }

  const vector = payload?.data?.[0]?.embedding
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Embedding response did not include a vector.')
  }

  return vector
}

async function upsertPoints(points, config) {
  const response = await fetch(
    buildQdrantURL(config, `collections/${config.collection}/points?wait=true`),
    {
      method: 'PUT',
      headers: createQdrantHeaders(config),
      body: JSON.stringify({ points })
    }
  )

  if (!response.ok) {
    const error = await readError(response)
    throw new Error(`Failed to upsert Qdrant points: ${error}`)
  }
}

function createPayload(item, text) {
  return {
    id: String(item.id || ''),
    type: String(item.type || 'reference'),
    title: String(item.title || ''),
    content: String(item.content || ''),
    tags: normalizeStringArray(item.tags),
    aliases: normalizeStringArray(item.aliases),
    priority: Number(item.priority || 0),
    source: String(item.source || ''),
    text
  }
}

function createEmbeddingInput(item) {
  return [
    `id: ${item.id || ''}`,
    `type: ${item.type || ''}`,
    `title: ${item.title || ''}`,
    `content: ${item.content || ''}`,
    `tags: ${normalizeStringArray(item.tags).join(', ')}`,
    `aliases: ${normalizeStringArray(item.aliases).join(', ')}`,
    `source: ${item.source || ''}`
  ].join('\n')
}

function createQdrantHeaders(config) {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (config.qdrantAPIKey) {
    headers['api-key'] = config.qdrantAPIKey
  }

  return headers
}

function createStableUUID(value) {
  const hex = createHash('sha256').update(String(value)).digest('hex')
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32)
  ].join('-')
}

function buildEmbeddingURL(baseURL) {
  return new URL(
    'embeddings',
    baseURL.endsWith('/') ? baseURL : `${baseURL}/`
  ).toString()
}

function buildQdrantURL(config, path) {
  return new URL(
    path,
    config.qdrantURL.endsWith('/') ? config.qdrantURL : `${config.qdrantURL}/`
  ).toString()
}

async function readJSONResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function readError(response) {
  const payload = await readJSONResponse(response)
  return (
    payload?.status?.error ||
    payload?.error ||
    response.statusText ||
    `HTTP ${response.status}`
  )
}

function normalizeURL(value) {
  const normalized = String(value || '').trim()
  return normalized ? normalized.replace(/\/+$/, '') : ''
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function readPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})
