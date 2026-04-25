#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'

import {
  createMockPlotProvider,
  createOpenAICompatibleProvider,
  renderAISpec,
  streamPlotSpec,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_PLAYGROUND_OPENAI_MODEL
} from '../dist/plot.js'
import { withNodeDom } from './dom.js'

const SERVER_INFO = {
  name: 'sparrow-mcp',
  version: '0.2.0'
}

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false
}

const providerSchema = z
  .enum(['mock', 'openai'])
  .describe('Provider backend. Defaults to mock.')

const specSchema = z
  .record(z.string(), z.unknown())
  .describe('A SparrowPlotSpec or Sparrow AI view spec object.')

const generateSpecOutputSchema = {
  provider: providerSchema,
  spec: specSchema,
  text: z.string()
}

const generateChartOutputSchema = {
  provider: providerSchema,
  spec: specSchema,
  svg: z.string(),
  text: z.string()
}

const server = new McpServer(SERVER_INFO, {
  debouncedNotificationMethods: ['notifications/tools/list_changed']
})

let domQueue = Promise.resolve()

server.registerTool(
  'sparrow_render_spec',
  {
    title: 'Render Sparrow Spec',
    description:
      'Render a Sparrow plot spec or AI view spec into an SVG string.',
    inputSchema: {
      spec: specSchema
    },
    outputSchema: {
      svg: z.string()
    },
    annotations: {
      ...TOOL_ANNOTATIONS,
      openWorldHint: false,
      idempotentHint: true
    }
  },
  async ({ spec }) => {
    try {
      const svg = await renderSpecToSVG(spec)
      return {
        content: [
          {
            type: 'text',
            text: 'Rendered Sparrow spec into SVG.'
          },
          createTextResource('sparrow://chart.svg', 'image/svg+xml', svg)
        ],
        structuredContent: { svg }
      }
    } catch (error) {
      return createToolError(formatError(error))
    }
  }
)

server.registerTool(
  'sparrow_generate_spec',
  {
    title: 'Generate Sparrow Spec',
    description:
      'Turn a natural-language chart prompt into a Sparrow spec using a mock or OpenAI-compatible provider.',
    inputSchema: {
      prompt: z.string().min(1).describe('Natural-language chart request.'),
      provider: providerSchema.optional(),
      systemPrompt: z
        .string()
        .min(1)
        .describe('Optional system prompt override for the chart model.')
        .optional()
    },
    outputSchema: generateSpecOutputSchema,
    annotations: {
      ...TOOL_ANNOTATIONS,
      openWorldHint: true
    }
  },
  async ({ prompt, provider = 'mock', systemPrompt }, extra) => {
    try {
      const normalizedPrompt = prompt.trim()
      const runtimeProvider = createProvider(provider, { systemPrompt })
      const payload = await streamPlotSpec({
        prompt: normalizedPrompt,
        provider: runtimeProvider,
        render: (spec) => spec,
        signal: extra.signal
      })

      const structuredContent = {
        provider,
        spec: payload.spec,
        text: payload.text
      }

      return {
        content: [
          {
            type: 'text',
            text: `Generated Sparrow spec with provider "${provider}".`
          },
          createTextResource(
            'sparrow://generated-spec.json',
            'application/json',
            JSON.stringify(payload.spec, null, 2)
          )
        ],
        structuredContent
      }
    } catch (error) {
      return createToolError(formatError(error))
    }
  }
)

server.registerTool(
  'sparrow_generate_chart',
  {
    title: 'Generate Sparrow Chart',
    description:
      'Generate a Sparrow spec from a prompt and render it into SVG.',
    inputSchema: {
      prompt: z.string().min(1).describe('Natural-language chart request.'),
      provider: providerSchema.optional(),
      systemPrompt: z
        .string()
        .min(1)
        .describe('Optional system prompt override for the chart model.')
        .optional()
    },
    outputSchema: generateChartOutputSchema,
    annotations: {
      ...TOOL_ANNOTATIONS,
      openWorldHint: true
    }
  },
  async ({ prompt, provider = 'mock', systemPrompt }, extra) => {
    try {
      const normalizedPrompt = prompt.trim()
      const runtimeProvider = createProvider(provider, { systemPrompt })
      const payload = await runSerializedDomTask(() =>
        withNodeDom(() =>
          streamPlotSpec({
            prompt: normalizedPrompt,
            provider: runtimeProvider,
            renderOptions: { autoplay: false },
            signal: extra.signal
          })
        )
      )

      const svg = payload.result?.node?.outerHTML
      if (!svg) {
        throw new Error('Chart rendered without producing an SVG node.')
      }

      const structuredContent = {
        provider,
        spec: payload.spec,
        svg,
        text: payload.text
      }

      return {
        content: [
          {
            type: 'text',
            text: `Generated Sparrow chart with provider "${provider}".`
          },
          createTextResource(
            'sparrow://generated-chart-spec.json',
            'application/json',
            JSON.stringify(payload.spec, null, 2)
          ),
          createTextResource(
            'sparrow://generated-chart.svg',
            'image/svg+xml',
            svg
          )
        ],
        structuredContent
      }
    } catch (error) {
      return createToolError(formatError(error))
    }
  }
)

async function renderSpecToSVG(spec) {
  return runSerializedDomTask(() =>
    withNodeDom(() => {
      const result = renderAISpec(spec, { autoplay: false })
      return result.node.outerHTML
    })
  )
}

function runSerializedDomTask(task) {
  const next = domQueue.then(task, task)
  domQueue = next.catch(() => {})
  return next
}

function createProvider(providerName, { systemPrompt } = {}) {
  if (providerName === 'mock') {
    return createMockPlotProvider({ delay: 0 })
  }

  const baseURL =
    readEnv(
      'SPARROW_MCP_BASE_URL',
      'SPARROW_LLM_BASE_URL',
      'OPENAI_PROXY_TARGET'
    ) || DEFAULT_OPENAI_BASE_URL
  const apiKey = readEnv(
    'SPARROW_MCP_API_KEY',
    'SPARROW_LLM_API_KEY',
    'OPENAI_API_KEY'
  )
  const model =
    readEnv('SPARROW_MCP_MODEL', 'SPARROW_LLM_MODEL') ||
    DEFAULT_PLAYGROUND_OPENAI_MODEL

  if (!apiKey && baseURL === DEFAULT_OPENAI_BASE_URL) {
    throw new Error(
      'OpenAI provider requires SPARROW_MCP_API_KEY, SPARROW_LLM_API_KEY, or OPENAI_API_KEY.'
    )
  }

  return createOpenAICompatibleProvider({
    baseURL,
    apiKey,
    model,
    ...(systemPrompt ? { systemPrompt } : {})
  })
}

function createTextResource(uri, mimeType, text) {
  return {
    type: 'resource',
    resource: {
      uri,
      mimeType,
      text
    }
  }
}

function createToolError(message) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message
      }
    ]
  }
}

function formatError(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

function readEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }
  return ''
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Sparrow MCP server is running on stdio.')
}

process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await server.close()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', formatError(error))
  process.exitCode = 1
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', formatError(error))
  process.exitCode = 1
})

main().catch((error) => {
  console.error('Server error:', formatError(error))
  process.exit(1)
})
