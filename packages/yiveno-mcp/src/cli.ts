#!/usr/bin/env bun
/**
 * 只读 MCP stdio 桥：把 Cursor 等客户端接到 Worker /api/mcp。
 * 环境变量：YIVENO_API_BASE_URL、YIVENO_ACCESS_TOKEN（Supabase access token）。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const TOOL_NAME = 'yiveno_recall_evidence' as const

const ArgsSchema = z.object({
  clue: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(5).optional()
})

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing env ${name}`)
  }
  return value
}

function apiBase(): string {
  return requireEnv('YIVENO_API_BASE_URL').replace(/\/$/, '')
}

function accessToken(): string {
  return requireEnv('YIVENO_ACCESS_TOKEN')
}

async function callWorker(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken()}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  })
}

async function main(): Promise<void> {
  const server = new Server(
    { name: 'yiveno-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const response = await callWorker('/api/mcp/tools')
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`tools/list failed: ${response.status} ${text}`)
    }
    const json = (await response.json()) as {
      data?: { tools?: Array<{ name: string; description: string; inputSchema: unknown }> }
    }
    const tools = json.data?.tools ?? []
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>
      }))
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (request.params.name !== TOOL_NAME) {
      throw new Error(`Unknown tool: ${request.params.name}`)
    }
    const args = ArgsSchema.parse(request.params.arguments ?? {})
    const response = await callWorker('/api/mcp/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: TOOL_NAME,
        arguments: args
      })
    })
    const text = await response.text()
    if (!response.ok) {
      return {
        content: [{ type: 'text' as const, text: `Error ${response.status}: ${text}` }],
        isError: true
      }
    }
    const json = JSON.parse(text) as {
      data?: { markdown?: string; pack?: unknown }
    }
    const markdown = json.data?.markdown ?? text
    return {
      content: [{ type: 'text' as const, text: markdown }]
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
