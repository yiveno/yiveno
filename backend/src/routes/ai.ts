/**
 * AI 路由
 *
 * - `/clue/complete`：v4 M1 扩展主路径（当前在用）
 * - `/hosted/*`：Phase C / Pro 托管 LLM 预留，当前扩展未接线
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleClueComplete } from '../handlers/ai-clue'
import { handleHostedComplete, handleHostedQuota } from '../handlers/ai-hosted'
import { supabaseAuth } from '../middleware/supabase-auth'

interface AiRouteEnv {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
  }
}

export const aiRouter = new Hono<AiRouteEnv>()

/**
 * POST /api/ai/clue/complete
 *
 * Recall 线索理解代理（DeepSeek Secret 在 Worker；按 IP 日配额）。
 * M1：扩展可无用户登录调用；后续可收紧为 Pro hosted。
 */
aiRouter.post('/clue/complete', async c => {
  return handleClueComplete(c.req.raw, c.env)
})

/**
 * GET /api/ai/hosted/quota
 *
 * Pro 托管 LLM 配额查询（Phase C 预留，当前无客户端）
 */
aiRouter.get('/hosted/quota', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedQuota(c.req.raw, c.env, userId)
})

/**
 * POST /api/ai/hosted/complete
 *
 * Pro 托管 LLM 文本补全（Phase C 预留，当前无客户端）
 */
aiRouter.post('/hosted/complete', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedComplete(c.req.raw, c.env, userId)
})
