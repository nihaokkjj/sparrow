export const DEFAULT_OPENAI_PROXY_PATH = '/api/openai'
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_OPENAI_MODEL = 'glm-5'
export const OPENAI_PROXY_TARGET_HEADER = 'X-Sparrow-Proxy-Target'

export function normalizeProxyPath(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return DEFAULT_OPENAI_PROXY_PATH

  const withLeadingSlash = normalized.startsWith('/')
    ? normalized
    : `/${normalized}`

  if (withLeadingSlash === '/') return withLeadingSlash
  return withLeadingSlash.replace(/\/+$/, '')
}

export function buildOpenAICompatibleRequestURL(
  baseURL,
  resourcePath = 'chat/completions'
) {
  const normalizedBaseURL = String(baseURL || '').trim()
  if (!normalizedBaseURL) {
    throw new Error('buildOpenAICompatibleRequestURL requires baseURL.')
  }

  const normalizedResourcePath = String(resourcePath || '')
    .trim()
    .replace(/^\/+/, '')

  if (!normalizedResourcePath) return normalizedBaseURL

  if (isAbsoluteURL(normalizedBaseURL)) {
    const base = normalizedBaseURL.endsWith('/')
      ? normalizedBaseURL
      : `${normalizedBaseURL}/`
    return new URL(normalizedResourcePath, base).toString()
  }

  return `${normalizedBaseURL.replace(/\/+$/, '')}/${normalizedResourcePath}`
}

export function buildProviderRequestConfig({
  connectionMode = 'proxy',
  proxyBaseURL = DEFAULT_OPENAI_PROXY_PATH,
  targetBaseURL = ''
} = {}) {
  const normalizedTargetBaseURL = String(targetBaseURL || '').trim()
  if (connectionMode === 'direct') {
    return {
      connectionMode: 'direct',
      baseURL: normalizedTargetBaseURL,
      headers: {}
    }
  }

  return {
    connectionMode: 'proxy',
    baseURL: normalizeProxyPath(proxyBaseURL),
    headers: normalizedTargetBaseURL
      ? {
          [OPENAI_PROXY_TARGET_HEADER]: normalizedTargetBaseURL
        }
      : {}
  }
}

export function getDefaultPlaygroundProviderSettings(env = {}) {
  return {
    connectionMode:
      env.VITE_OPENAI_CONNECTION_MODE === 'direct' ? 'direct' : 'proxy',
    proxyBaseURL: normalizeProxyPath(
      env.VITE_OPENAI_PROXY_PATH || DEFAULT_OPENAI_PROXY_PATH
    ),
    targetBaseURL: String(env.VITE_OPENAI_BASE_URL || '').trim(),
    model:
      String(env.VITE_OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() ||
      DEFAULT_OPENAI_MODEL
  }
}

export function buildProxyTargetURL({
  proxyPath = DEFAULT_OPENAI_PROXY_PATH,
  requestURL,
  targetBaseURL
}) {
  const normalizedProxyPath = normalizeProxyPath(proxyPath)
  const normalizedTargetBaseURL = String(targetBaseURL || '').trim()

  if (!normalizedTargetBaseURL) {
    throw new Error('buildProxyTargetURL requires targetBaseURL.')
  }

  if (!isAbsoluteURL(normalizedTargetBaseURL)) {
    throw new Error('Proxy target must be an absolute http(s) URL.')
  }

  const target = new URL(normalizedTargetBaseURL)
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Proxy target must use http or https.')
  }

  const incoming = new URL(requestURL || '/', 'http://sparrow.local')
  if (
    incoming.pathname !== normalizedProxyPath &&
    !incoming.pathname.startsWith(`${normalizedProxyPath}/`)
  ) {
    throw new Error('Request URL does not match the configured proxy path.')
  }

  const suffix = incoming.pathname
    .slice(normalizedProxyPath.length)
    .replace(/^\/+/, '')
  const upstream = new URL(
    suffix,
    normalizedTargetBaseURL.endsWith('/')
      ? normalizedTargetBaseURL
      : `${normalizedTargetBaseURL}/`
  )
  upstream.search = incoming.search
  return upstream.toString()
}

function isAbsoluteURL(value) {
  return /^[a-zA-Z][\w+.-]*:\/\//.test(value)
}
