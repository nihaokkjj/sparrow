import { DEFAULT_OPENAI_BASE_URL } from '../src/plot/providerConfig.js'

const PROXY_TARGET_HEADER = 'x-sparrow-proxy-target'
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])
const BROWSER_ONLY_HEADERS = new Set([
  'origin',
  'referer',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user'
])

export const config = {
  maxDuration: 60
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      })
    }

    const url = new URL(request.url)
    const resourcePath = normalizeResourcePath(url.searchParams.get('path'))
    const targetOverride = request.headers.get(PROXY_TARGET_HEADER)
    const targetBaseURL =
      targetOverride ||
      process.env.OPENAI_PROXY_TARGET ||
      DEFAULT_OPENAI_BASE_URL

    if (targetOverride && !isAllowedRuntimeTarget(targetOverride)) {
      return jsonError('Proxy target is not in OPENAI_PROXY_ALLOWLIST.', 403)
    }

    let upstreamURL
    try {
      upstreamURL = buildUpstreamURL(targetBaseURL, resourcePath, url.search)
    } catch (error) {
      return jsonError(error?.message || 'Invalid proxy target.', 400)
    }

    try {
      const upstreamResponse = await fetch(upstreamURL, {
        method: request.method,
        headers: createUpstreamHeaders(request.headers),
        body: allowsRequestBody(request.method) ? request.body : undefined,
        duplex: allowsRequestBody(request.method) ? 'half' : undefined
      })

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: createResponseHeaders(upstreamResponse.headers)
      })
    } catch (error) {
      return jsonError(error?.message || 'Proxy request failed.', 502)
    }
  }
}

function buildUpstreamURL(targetBaseURL, resourcePath, originalSearch) {
  const normalizedTargetBaseURL = String(targetBaseURL || '').trim()
  if (!normalizedTargetBaseURL) {
    throw new Error('OPENAI_PROXY_TARGET is not configured.')
  }

  const target = new URL(normalizedTargetBaseURL)
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Proxy target must use http or https.')
  }

  const base = normalizedTargetBaseURL.endsWith('/')
    ? normalizedTargetBaseURL
    : `${normalizedTargetBaseURL}/`
  const upstream = new URL(resourcePath, base)
  const searchParams = new URLSearchParams(originalSearch)
  searchParams.delete('path')
  upstream.search = searchParams.toString()
  return upstream
}

function normalizeResourcePath(path) {
  const normalized = String(path || '')
    .trim()
    .replace(/^\/+/, '')
  return normalized || 'chat/completions'
}

function isAllowedRuntimeTarget(targetBaseURL) {
  if (process.env.OPENAI_ALLOW_ANY_PROXY_TARGET === 'true') return true

  const allowlist = String(
    process.env.OPENAI_PROXY_ALLOWLIST ||
      process.env.OPENAI_PROXY_TARGET ||
      DEFAULT_OPENAI_BASE_URL
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return allowlist.some((allowedTarget) =>
    isSameOrNestedTarget(targetBaseURL, allowedTarget)
  )
}

function isSameOrNestedTarget(targetBaseURL, allowedTarget) {
  try {
    const target = new URL(targetBaseURL)
    const allowed = new URL(allowedTarget)
    const allowedPath = allowed.pathname.endsWith('/')
      ? allowed.pathname
      : `${allowed.pathname}/`
    const targetPath = target.pathname.endsWith('/')
      ? target.pathname
      : `${target.pathname}/`

    return (
      target.protocol === allowed.protocol &&
      target.host === allowed.host &&
      targetPath.startsWith(allowedPath)
    )
  } catch {
    return false
  }
}

function createUpstreamHeaders(requestHeaders) {
  const headers = new Headers()

  for (const [name, value] of requestHeaders.entries()) {
    const normalizedName = name.toLowerCase()
    if (
      HOP_BY_HOP_HEADERS.has(normalizedName) ||
      BROWSER_ONLY_HEADERS.has(normalizedName) ||
      normalizedName === PROXY_TARGET_HEADER
    ) {
      continue
    }

    headers.set(name, value)
  }

  if (!headers.has('authorization') && process.env.OPENAI_API_KEY) {
    headers.set('authorization', `Bearer ${process.env.OPENAI_API_KEY}`)
  }

  return headers
}

function createResponseHeaders(upstreamHeaders) {
  const headers = new Headers(corsHeaders())

  for (const [name, value] of upstreamHeaders.entries()) {
    const normalizedName = name.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) continue
    headers.set(name, value)
  }

  return headers
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Sparrow-Proxy-Target'
  }
}

function jsonError(message, status) {
  return Response.json(
    { error: message },
    {
      status,
      headers: corsHeaders()
    }
  )
}

function allowsRequestBody(method) {
  return !['GET', 'HEAD'].includes(String(method || 'GET').toUpperCase())
}
