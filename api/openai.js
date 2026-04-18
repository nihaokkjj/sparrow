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
const DEFAULT_RATE_LIMIT_MAX = 20
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000
const rateLimitStore = new Map()
let lastRateLimitPruneAt = 0

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

    const rateLimit = checkRateLimit(request)
    if (!rateLimit.allowed) {
      return jsonError(
        'Rate limit exceeded. Please try again later.',
        429,
        corsOptions,
        rateLimit.headers
      )
    }

    const url = new URL(request.url)
    const resourcePath = normalizeResourcePath(url.searchParams.get('path'))
    const targetOverride = request.headers.get(PROXY_TARGET_HEADER)
    const targetBaseURL =
      targetOverride ||
      process.env.OPENAI_PROXY_TARGET ||
      DEFAULT_OPENAI_BASE_URL

    if (targetOverride && !request.headers.has('authorization')) {
      return jsonError(
        'Authorization is required when using a runtime proxy target.',
        401,
        corsOptions,
        rateLimit.headers
      )
    }

    if (targetOverride && !isAllowedRuntimeTarget(targetOverride, request)) {
      return jsonError(
        'Proxy target is not in OPENAI_PROXY_ALLOWLIST.',
        403,
        corsOptions,
        rateLimit.headers
      )
    }

    let upstreamURL
    try {
      upstreamURL = buildUpstreamURL(targetBaseURL, resourcePath, url.search)
    } catch (error) {
      return jsonError(
        error?.message || 'Invalid proxy target.',
        400,
        corsOptions,
        rateLimit.headers
      )
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
        headers: createResponseHeaders(
          upstreamResponse.headers,
          corsOptions,
          rateLimit.headers
        )
      })
    } catch (error) {
      return jsonError(
        error?.message || 'Proxy request failed.',
        502,
        corsOptions,
        rateLimit.headers
      )
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

function isAllowedRuntimeTarget(targetBaseURL, request) {
  if (
    request.headers.has('authorization') &&
    process.env.OPENAI_ALLOW_USER_PROXY_TARGETS !== 'false'
  ) {
    return true
  }

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

function createResponseHeaders(upstreamHeaders, corsOptions, extraHeaders) {
  const headers = new Headers(corsHeaders(corsOptions))

  for (const [name, value] of upstreamHeaders.entries()) {
    const normalizedName = name.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) continue
    headers.set(name, value)
  }

  return mergeHeaders(headers, extraHeaders)
}

function resolveCorsOptions(request) {
  const allowedOrigins = getAllowedOrigins()
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

function getAllowedOrigins() {
  return String(process.env.OPENAI_PROXY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function corsHeaders({ allowed, origin } = {}) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Sparrow-Proxy-Target',
    Vary: 'Origin'
  }

  if (allowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

function jsonError(message, status, corsOptions, extraHeaders) {
  return Response.json(
    { error: message },
    {
      status,
      headers: mergeHeaders(corsHeaders(corsOptions), extraHeaders)
    }
  )
}

function allowsRequestBody(method) {
  return !['GET', 'HEAD'].includes(String(method || 'GET').toUpperCase())
}

function checkRateLimit(request) {
  const limit = readNonNegativeInteger(
    process.env.OPENAI_PROXY_RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX
  )
  if (limit <= 0) {
    return {
      allowed: true,
      headers: {}
    }
  }

  const windowMs = readPositiveInteger(
    process.env.OPENAI_PROXY_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS
  )
  const now = Date.now()
  pruneRateLimitStore(now)

  const key = getClientKey(request)
  const current = rateLimitStore.get(key)
  const entry =
    current && current.resetAt > now
      ? current
      : {
          count: 0,
          resetAt: now + windowMs
        }

  entry.count += 1
  rateLimitStore.set(key, entry)

  const remaining = Math.max(limit - entry.count, 0)
  const resetSeconds = Math.ceil(entry.resetAt / 1000)
  const headers = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetSeconds)
  }

  if (entry.count > limit) {
    headers['Retry-After'] = String(Math.ceil((entry.resetAt - now) / 1000))
    return {
      allowed: false,
      headers
    }
  }

  return {
    allowed: true,
    headers
  }
}

function getClientKey(request) {
  return getClientIP(request) || 'unknown'
}

function getClientIP(request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    ''
  )
}

function pruneRateLimitStore(now) {
  if (now - lastRateLimitPruneAt < DEFAULT_RATE_LIMIT_WINDOW_MS) return
  lastRateLimitPruneAt = now

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

function readPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function readNonNegativeInteger(value, fallback) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function mergeHeaders(baseHeaders, extraHeaders) {
  const headers = new Headers(baseHeaders)
  Object.entries(extraHeaders || {}).forEach(([name, value]) => {
    headers.set(name, value)
  })
  return headers
}
