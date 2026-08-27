/**
 * 只读 MCP HTTP（§5.10.5）：tools/list + tools/call。
 * 门禁：Bearer + AI_USAGE_KV 开关 + Pro（云 Memory）+ 仅 yiveno_recall_evidence。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import { supabaseAuth } from '../middleware/supabase-auth'
import { isActiveProUser } from '../services/ai/require-pro-user'
import {
  McpRecallArgsSchema,
  recallCloudKeywordEvidence,
  renderMcpEvidenceMarkdown
} from '../services/mcp/cloud-keyword-recall'
import { getMcpReadOnlyEnabled } from '../services/mcp/mcp-preference-kv'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

const MCP_TOOL_NAME = 'yiveno_recall_evidence' as const

type McpVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const mcpRouter = new Hono<McpVars>()

mcpRouter.use('*', supabaseAuth())

const toolDescriptors = [
  {
    name: MCP_TOOL_NAME,
    description:
      'Recall personal traces from the user Yiveno cloud library as a scoped evidence pack (1–5 items). Read-only. Never dumps the full library. Cloud path is keyword-only (not Hybrid).',
    inputSchema: {
      type: 'object',
      properties: {
        clue: { type: 'string', description: 'Natural-language clue' },
        limit: { type: 'integer', minimum: 1, maximum: 5 }
      },
      required: ['clue']
    }
  }
] as const

async function requireMcpGate(
  env: Env,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 403 | 503; error: string }> {
  if (!env.AI_USAGE_KV) {
    return { ok: false, status: 503, error: 'kv_unavailable' }
  }
  const enabled = await getMcpReadOnlyEnabled(env, userId)
  if (!enabled) {
    return { ok: false, status: 403, error: 'mcp_disabled' }
  }
  const isPro = await isActiveProUser(env, userId)
  if (!isPro) {
    return { ok: false, status: 403, error: 'mcp_pro_required' }
  }
  return { ok: true }
}

/**
 * GET /api/mcp/tools
 * 列出只读工具（闭集）。
 */
mcpRouter.get('/tools', async c => {
  const userId = c.get('supabaseUserId')
  const gate = await requireMcpGate(c.env, userId)
  if (!gate.ok) {
    return c.json({ error: gate.error }, gate.status)
  }
  return c.json({ success: true, data: { tools: toolDescriptors } })
})

const ToolsCallBodySchema = z.object({
  name: z.literal(MCP_TOOL_NAME),
  arguments: z.unknown()
})

/**
 * POST /api/mcp/tools/call
 * 调用 yiveno_recall_evidence → evidence pack + markdown。
 */
mcpRouter.post('/tools/call', async c => {
  const userId = c.get('supabaseUserId')
  const gate = await requireMcpGate(c.env, userId)
  if (!gate.ok) {
    return c.json({ error: gate.error }, gate.status)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const parsedCall = ToolsCallBodySchema.safeParse(body)
  if (!parsedCall.success) {
    return c.json({ error: 'invalid_tool_call' }, 400)
  }

  const parsedArgs = McpRecallArgsSchema.safeParse(parsedCall.data.arguments)
  if (!parsedArgs.success) {
    return c.json({ error: 'invalid_arguments' }, 400)
  }

  const limit = parsedArgs.data.limit ?? 3
  try {
    const pack = await recallCloudKeywordEvidence(c.env, userId, parsedArgs.data.clue, limit)
    if (!pack) {
      info('[Mcp] tools/call 无命中', { userId })
      return c.json({ error: 'mcp_no_match' }, 404)
    }
    const markdown = renderMcpEvidenceMarkdown(pack)
    info('[Mcp] tools/call 成功', { userId, itemCount: pack.items.length })
    return c.json({
      success: true,
      data: {
        ok: true,
        pack,
        markdown,
        backend: 'cloud_keyword' as const
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Mcp] tools/call 异常', { detail: msg, userId })
    return c.json({ error: 'mcp_operation_failed' }, 500)
  }
})
