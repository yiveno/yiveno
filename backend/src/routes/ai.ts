/**
 * AI 路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAIComplete } from '../handlers/ai'
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
 * GET/POST /api/ai/complete
 *
 * 旧版 Workers AI 文本补全（保留兼容，无鉴权）
 */
aiRouter.get('/complete', async c => {
  return handleAIComplete(c.req.raw, c.env)
})

aiRouter.post('/complete', async c => {
  return handleAIComplete(c.req.raw, c.env)
})

/**
 * GET /api/ai/hosted/quota
 *
 * Pro 托管 LLM 配额查询
 */
aiRouter.get('/hosted/quota', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedQuota(c.req.raw, c.env, userId)
})

/**
 * POST /api/ai/hosted/complete
 *
 * Pro 托管 LLM 文本补全
 */
aiRouter.post('/hosted/complete', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedComplete(c.req.raw, c.env, userId)
})
