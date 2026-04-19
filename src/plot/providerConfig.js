export const DEFAULT_OPENAI_PROXY_PATH = '/api/openai'
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_OPENAI_MODEL = 'glm-5'
export const DEFAULT_PLAYGROUND_PROVIDER = 'zhipu'
export const DEFAULT_PLAYGROUND_OPENAI_MODEL = 'gpt-4.1-mini'
export const OPENAI_PROXY_TARGET_HEADER = 'X-Sparrow-Proxy-Target'

export function normalizePlaygroundProvider(value) {
  return String(value || '').trim() === 'openai'
    ? 'openai'
    : DEFAULT_PLAYGROUND_PROVIDER
}

export function getPlaygroundProviderProfile(
  provider = DEFAULT_PLAYGROUND_PROVIDER,
  env = {}
) {
  const normalizedProvider = normalizePlaygroundProvider(provider)

  if (normalizedProvider === 'openai') {
    return {
      id: 'openai',
      label: 'OpenAI',
      connectionMode:
        env.VITE_PLAYGROUND_OPENAI_CONNECTION_MODE === 'direct'
          ? 'direct'
          : 'proxy',
      targetBaseURL:
        String(
          env.VITE_PLAYGROUND_OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL
        ).trim() || DEFAULT_OPENAI_BASE_URL,
      model:
        String(
          env.VITE_PLAYGROUND_OPENAI_MODEL || DEFAULT_PLAYGROUND_OPENAI_MODEL
        ).trim() || DEFAULT_PLAYGROUND_OPENAI_MODEL,
      directTargetPlaceholder:
        'https://api.openai.com/v1 或其他允许 CORS 的 relay URL',
      proxyTargetPlaceholder:
        '留空则使用 OpenAI 官方 Base URL；代理模式下请填写你自己的 API Key',
      directHint:
        'Direct 模式会由浏览器直接请求目标地址。OpenAI 官方接口通常不建议浏览器直连，建议优先使用 proxy 或支持 CORS 的 relay URL。',
      proxyHint:
        'Proxy 模式会先请求 /api/openai，再转发到 OpenAI 官方接口或兼容端点。切到 OpenAI 时，请填写你自己的 API Key。'
    }
  }

  return {
    id: DEFAULT_PLAYGROUND_PROVIDER,
    label: '智谱 AI（已配置）',
    connectionMode:
      env.VITE_OPENAI_CONNECTION_MODE === 'direct' ? 'direct' : 'proxy',
    targetBaseURL: String(env.VITE_OPENAI_BASE_URL || '').trim(),
    model:
      String(env.VITE_OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() ||
      DEFAULT_OPENAI_MODEL,
    directTargetPlaceholder: 'https://open.bigmodel.cn/api/paas/v4 或其他兼容端点',
    proxyTargetPlaceholder: '留空则使用服务端已配置的智谱目标地址',
    directHint:
      'Direct 模式会由浏览器直接请求目标地址，因此目标接口必须允许 CORS；此时请使用你自己的 API Key。',
    proxyHint:
      'Proxy 模式会先请求 /api/openai。Target Base URL 和 API Key 都留空时，将使用服务端已配置的智谱设置。'
  }
}

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

export function getDefaultPlaygroundProviderSettings(
  env = {},
  provider = DEFAULT_PLAYGROUND_PROVIDER
) {
  const profile = getPlaygroundProviderProfile(provider, env)
  return {
    connectionMode: profile.connectionMode,
    proxyBaseURL: normalizeProxyPath(
      env.VITE_OPENAI_PROXY_PATH || DEFAULT_OPENAI_PROXY_PATH
    ),
    targetBaseURL: profile.targetBaseURL,
    model: profile.model
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
