# Sparrow MCP Server

Sparrow 现在可以作为一个本地 `stdio` MCP Server 运行，让 AI Agent 直接调用图表生成与 SVG 渲染能力。

当前实现基于官方 `@modelcontextprotocol/sdk`：

- 协议层由 `McpServer` 管理
- `stdio` 传输由 `StdioServerTransport` 管理
- 工具输入输出 schema 由 `zod` 定义

这样比手写 `initialize / tools/list / tools/call` 更贴近标准 MCP Server 实现。

## 可用工具

- `sparrow_render_spec`
  - 输入：`{ spec }`
  - 作用：把 Sparrow spec 渲染成 SVG
- `sparrow_generate_spec`
  - 输入：`{ prompt, provider?, systemPrompt? }`
  - 作用：把自然语言提示词转换成 Sparrow spec
- `sparrow_generate_chart`
  - 输入：`{ prompt, provider?, systemPrompt? }`
  - 作用：一步生成 Sparrow spec 并渲染成 SVG

默认 `provider` 是 `mock`。如果要走真实模型，把 `provider` 设为 `openai`，并配置环境变量。

## 启动

```bash
pnpm mcp
```

服务通过标准输入输出收发 MCP JSON-RPC 消息，适合被 Claude Desktop、Cursor、Codex 等 Agent 进程直接拉起。

如果你刚修改过 `src/` 里的图表运行时代码，先执行一次 `pnpm build`，再启动 MCP Server，这样 `mcp/server.js` 会加载最新的 `dist/plot.js`。

## 环境变量

当 `provider = "openai"` 时，服务会按下面顺序读取配置：

- Base URL
  - `SPARROW_MCP_BASE_URL`
  - `SPARROW_LLM_BASE_URL`
  - `OPENAI_PROXY_TARGET`
  - 默认值：`https://api.openai.com/v1`
- API Key
  - `SPARROW_MCP_API_KEY`
  - `SPARROW_LLM_API_KEY`
  - `OPENAI_API_KEY`
- Model
  - `SPARROW_MCP_MODEL`
  - `SPARROW_LLM_MODEL`
  - 默认值：`gpt-4.1-mini`

## 客户端配置示例

```json
{
  "mcpServers": {
    "sparrow": {
      "command": "node",
      "args": [
        "D:/front/Infographic-main/Infographic-main/sparrow/mcp/server.js"
      ],
      "env": {
        "SPARROW_MCP_API_KEY": "sk-...",
        "SPARROW_MCP_MODEL": "gpt-4.1-mini"
      }
    }
  }
}
```

## 本地 Smoke Test

```powershell
@'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sparrow_generate_chart","arguments":{"prompt":"Create a bar chart of quarterly revenue","provider":"mock"}}}
'@ | node .\mcp\server.js
```
