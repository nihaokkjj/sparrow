export const DEFAULT_VECTOR_RAG_ENDPOINT = '/api/rag'

export async function retrieveVectorSparrowSyntaxKnowledge(
  prompt,
  {
    endpoint = DEFAULT_VECTOR_RAG_ENDPOINT,
    topK,
    filters,
    signal,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const normalizedEndpoint = String(endpoint || '').trim()
  if (!normalizedEndpoint) return []

  if (typeof fetchImpl !== 'function') {
    throw new Error('Vector RAG retrieval requires fetch().')
  }

  const body = { prompt }
  if (topK !== undefined) body.topK = topK
  if (filters !== undefined) body.filters = filters

  const response = await fetchImpl(normalizedEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal
  })

  const payload = await readJSONResponse(response)
  if (!response.ok) {
    throw new Error(
      payload?.error || `Vector RAG request failed with ${response.status}.`
    )
  }

  return normalizeVectorRAGMatches(payload?.matches)
}

export function normalizeVectorRAGMatches(matches) {
  return Array.isArray(matches)
    ? matches
        .map((match) => {
          if (!match) return null
          if (match.item) return match
          return { item: match }
        })
        .filter((match) => match?.item?.content || match?.item?.title)
    : []
}

async function readJSONResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
