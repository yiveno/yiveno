/**
 * 账户路由：删除账号、订阅状态、只读 MCP 开关等（Supabase Auth Bearer）。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import { deleteAccountForOwner } from '../data-access/account-delete'
import { getSubscriptionStatusOrThrow } from '../handlers/subscription'
import { supabaseAuth } from '../middleware/supabase-auth'
import { putMcpReadOnlyEnabled } from '../services/mcp/mcp-preference-kv'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

type AccountVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const accountRouter = new Hono<AccountVars>()

accountRouter.use('*', supabaseAuth())

/**
 * GET /api/account/subscription
 * 扩展主路径：当前用户是否 Pro（与 memory sync 同一 Bearer）。
 */
accountRouter.get('/subscription', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const data = await getSubscriptionStatusOrThrow(c.env, userId)
    info('[Account] 查询订阅', { userId, isPro: data.isPro, tier: data.tier })
    return c.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Account] subscription 异常', { detail: msg, userId })
    return c.json(
      {
        error: msg === 'subscription_status_failed' ? msg : 'subscription_status_failed'
      },
      500
    )
  }
})

const McpPreferenceBodySchema = z.object({
  /** 是否允许云端只读 MCP */
  enabled: z.boolean()
})

/**
 * PUT /api/account/mcp
 * 同步 Settings「只读 MCP」开关到 AI_USAGE_KV（供 /api/mcp 门禁）。
 */
accountRouter.put('/mcp', async c => {
  const userId = c.get('supabaseUserId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }
  const parsed = McpPreferenceBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid_body' }, 400)
  }
  const result = await putMcpReadOnlyEnabled(c.env, userId, parsed.data.enabled)
  if (!result.ok) {
    logErrorMessage('[Account] MCP 开关写入失败', { userId, error: result.error })
    return c.json({ error: result.error }, 503)
  }
  info('[Account] MCP 开关已同步', { userId, enabled: parsed.data.enabled })
  return c.json({ success: true, data: { enabled: parsed.data.enabled } })
})

/**
 * POST /api/account/delete
 * 删除云端 Memory/backups 并注销 Auth 用户（不可恢复）。
 */
accountRouter.post('/delete', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const result = await deleteAccountForOwner(c.env, userId)
    return c.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Account] delete 异常', { detail: msg, userId })
    return c.json(
      {
        error:
          msg === 'supabase_not_configured' || msg === 'account_delete_failed'
            ? msg
            : 'account_delete_failed'
      },
      500
    )
  }
})
