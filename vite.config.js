/// <reference types="vitest/config" />
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import ragApi from './api/rag.js'
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_PROXY_PATH,
  OPENAI_PROXY_TARGET_HEADER,
  buildProxyTargetURL,
  normalizeProxyPath
} from './src/plot/providerConfig.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export const libraryEntries = {
  sparrow: path.resolve(rootDir, './src/index.js'),
  plot: path.resolve(rootDir, './src/plot/index.js'),
  guide: path.resolve(rootDir, './src/guide/index.js'),
  views: path.resolve(rootDir, './src/views/index.js')
}

export function createViteConfig(mode = process.env.NODE_ENV || 'development') {
  const env = loadEnv(mode, rootDir, '')
  const proxyPath = normalizeProxyPath(
    env.OPENAI_PROXY_PATH || DEFAULT_OPENAI_PROXY_PATH
  )
  const proxyTarget = env.OPENAI_PROXY_TARGET || DEFAULT_OPENAI_BASE_URL
  const proxyAuthToken = env.OPENAI_API_KEY || ''
  const ragPath = normalizeLocalPath(env.VITE_RAG_ENDPOINT || '/api/rag')

  return {
    build: {
      lib: {
        entry: libraryEntries,
        formats: ['es', 'cjs'],
        fileName: (format, entryName) =>
          `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
        '@renderer': path.resolve(rootDir, './src/renderer')
      },
      extensions: ['.js', '.ts', '.vue', '.json']
    },
    server: {
      proxy: {}
    },
    plugins: [
      createRAGApiPlugin({
        ragPath
      }),
      createOpenAIProxyPlugin({
        proxyPath,
        defaultTarget: proxyTarget,
        authToken: proxyAuthToken
      })
    ],
    test: {
      environment: 'jsdom',
      include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)']
    }
  }
}

export default defineConfig(createViteConfig())

function createRAGApiPlugin({ ragPath = '/api/rag' } = {}) {
  return {
    name: 'sparrow-rag-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!shouldProxyRequest(req.url, ragPath)) {
          next()
          return
        }

        try {
          const response = await ragApi.fetch(createFetchRequest(req))
          writeFetchResponse(res, response)
        } catch (error) {
          writeProxyError(res, 500, error?.message || 'RAG request failed.')
        }
      })
    }
  }
}

function createOpenAIProxyPlugin({ proxyPath, defaultTarget, authToken }) {
  return {
    name: 'sparrow-openai-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!shouldProxyRequest(req.url, proxyPath)) {
          next()
          return
        }

        const targetOverride = readHeaderValue(
          req.headers[OPENAI_PROXY_TARGET_HEADER.toLowerCase()]
        )
        const targetBaseURL = targetOverride || defaultTarget

        if (!targetBaseURL) {
          writeProxyError(res, 500, 'Proxy target is not configured.')
          return
        }

        let upstreamURL
        try {
          upstreamURL = buildProxyTargetURL({
            proxyPath,
            requestURL: req.url,
            targetBaseURL
          })
        } catch (error) {
          writeProxyError(res, 400, error?.message || 'Invalid proxy target.')
          return
        }

        try {
          const upstreamResponse = await fetch(upstreamURL, {
            method: req.method,
            headers: createUpstreamHeaders(req.headers, authToken),
            ...(allowsRequestBody(req.method)
              ? { body: req, duplex: 'half' }
              : {})
          })

          res.statusCode = upstreamResponse.status
          res.statusMessage = upstreamResponse.statusText

          upstreamResponse.headers.forEach((value, name) => {
            if (
              ['connection', 'content-length', 'transfer-encoding'].includes(
                name
              )
            ) {
              return
            }
            res.setHeader(name, value)
          })

          if (!upstreamResponse.body) {
            res.end()
            return
          }

          Readable.fromWeb(upstreamResponse.body).pipe(res)
        } catch (error) {
          writeProxyError(res, 502, error?.message || 'Proxy request failed.')
        }
      })
    }
  }
}

function createFetchRequest(req) {
  return new Request(new URL(req.url || '/', 'http://sparrow.local'), {
    method: req.method,
    headers: createFetchHeaders(req.headers),
    ...(allowsRequestBody(req.method) ? { body: req, duplex: 'half' } : {})
  })
}

function createFetchHeaders(requestHeaders) {
  const headers = new Headers()

  for (const [name, value] of Object.entries(requestHeaders)) {
    if (value == null) continue

    if (Array.isArray(value)) {
      value.forEach((item) => {
        headers.append(name, item)
      })
      continue
    }

    headers.set(name, value)
  }

  return headers
}

function writeFetchResponse(res, response) {
  res.statusCode = response.status
  res.statusMessage = response.statusText

  response.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  Readable.fromWeb(response.body).pipe(res)
}

function createUpstreamHeaders(requestHeaders, authToken) {
  const headers = new Headers()

  for (const [name, value] of Object.entries(requestHeaders)) {
    if (value == null) continue

    const normalizedName = name.toLowerCase()
    if (
      normalizedName === 'host' ||
      normalizedName === OPENAI_PROXY_TARGET_HEADER.toLowerCase()
    ) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        headers.append(name, item)
      })
      continue
    }

    headers.set(name, value)
  }

  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  return headers
}

function shouldProxyRequest(requestURL, proxyPath) {
  if (!requestURL) return false
  const pathname = new URL(requestURL, 'http://sparrow.local').pathname
  return pathname === proxyPath || pathname.startsWith(`${proxyPath}/`)
}

function normalizeLocalPath(value) {
  const normalized = String(value || '').trim()
  if (/^[a-zA-Z][\w+.-]*:\/\//.test(normalized)) {
    return normalizeProxyPath(new URL(normalized).pathname)
  }

  return normalizeProxyPath(normalized || '/api/rag')
}

function readHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || ''
  return typeof value === 'string' ? value.trim() : ''
}

function allowsRequestBody(method) {
  return !['GET', 'HEAD'].includes(String(method || 'GET').toUpperCase())
}

function writeProxyError(res, statusCode, message) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: message }))
}
