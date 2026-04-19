import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import openAIProxy from '../../api/openai.js'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv }
  process.env.OPENAI_PROXY_TARGET = 'https://open.bigmodel.cn/api/paas/v4'
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_PROXY_ALLOWED_ORIGINS = 'https://sparrow.example'
  process.env.OPENAI_PROXY_RATE_LIMIT_MAX = '20'
  process.env.OPENAI_PROXY_RATE_LIMIT_WINDOW_MS = '60000'
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('ok', {
      status: 200,
      headers: {
        'content-type': 'text/event-stream'
      }
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
})

test('Vercel proxy rejects requests from origins outside the allowlist', async () => {
  const response = await openAIProxy.fetch(
    createProxyRequest({
      origin: 'https://evil.example',
      ip: '203.0.113.10'
    })
  )

  expect(response.status).toBe(403)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  expect(globalThis.fetch).not.toHaveBeenCalled()
})

test('Vercel proxy forwards allowed origins with matching CORS headers', async () => {
  const response = await openAIProxy.fetch(
    createProxyRequest({
      origin: 'https://sparrow.example',
      ip: '203.0.113.11'
    })
  )

  expect(response.status).toBe(200)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
    'https://sparrow.example'
  )
  expect(response.headers.get('X-RateLimit-Remaining')).toBe('19')
  const [upstreamURL, upstreamOptions] = globalThis.fetch.mock.calls[0]
  expect(String(upstreamURL)).toBe(
    'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  )
  expect(upstreamOptions.method).toBe('POST')
  expect(upstreamOptions.headers).toBeTruthy()
})

test('Vercel proxy rate limits repeated requests from the same IP', async () => {
  process.env.OPENAI_PROXY_RATE_LIMIT_MAX = '2'

  const createLimitedRequest = () =>
    createProxyRequest({
      origin: 'https://sparrow.example',
      ip: '203.0.113.12'
    })

  expect((await openAIProxy.fetch(createLimitedRequest())).status).toBe(200)
  expect((await openAIProxy.fetch(createLimitedRequest())).status).toBe(200)

  const blockedResponse = await openAIProxy.fetch(createLimitedRequest())

  expect(blockedResponse.status).toBe(429)
  expect(blockedResponse.headers.get('Retry-After')).toBeTruthy()
  expect(blockedResponse.headers.get('X-RateLimit-Remaining')).toBe('0')
  expect(globalThis.fetch).toHaveBeenCalledTimes(2)
})

test('Vercel proxy allows the official OpenAI target as a built-in safe runtime target', async () => {
  process.env.OPENAI_ALLOW_USER_PROXY_TARGETS = 'false'

  const response = await openAIProxy.fetch(
    createProxyRequest({
      origin: 'https://sparrow.example',
      ip: '203.0.113.13',
      headers: {
        authorization: 'Bearer user-key',
        'x-sparrow-proxy-target': 'https://api.openai.com/v1'
      }
    })
  )

  expect(response.status).toBe(200)
  expect(String(globalThis.fetch.mock.calls[0][0])).toBe(
    'https://api.openai.com/v1/chat/completions'
  )
})

function createProxyRequest({ origin, ip, headers = {} }) {
  return new Request('https://sparrow.example/api/openai/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-forwarded-for': ip,
      ...headers
    },
    body: JSON.stringify({
      model: 'glm-4.7-flash',
      messages: []
    })
  })
}
