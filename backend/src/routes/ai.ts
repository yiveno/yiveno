/**
 * AI 路由
 *
 * - `/clue/complete`：开发/未登录降级路径（IP 日配额；正式 Pro 走 hosted）
 * - `/enrichment/complete`：Capture enrichment 结构化提议（扩展 merge 后写库）
 * - `/hosted/*`：Pro 托管口语 LLM（Bearer + 月配额；扩展已接线）
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleClueComplete } from '../handlers/ai-clue'
import { handleEmbed } from '../handlers/ai-embed'
import { handleEnrichmentComplete } from '../handlers/ai-enrichment'
import { handleHostedComplete, handleHostedQuota } from '../handlers/ai-hosted'
import { supabaseAuth } from '../middleware/supabase-auth'

interface AiRouteEnv {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const aiRouter = new Hono<AiRouteEnv>()

/**
 * POST /api/ai/clue/complete
 *
 * 开发用线索理解代理（按 IP 日配额）。正式 Pro 路径见 `/hosted/complete`。
 */
aiRouter.post('/clue/complete', async c => {
  return handleClueComplete(c.req.raw, c.env)
})

/**
 * POST /api/ai/enrichment/complete
 *
 * Capture enrichment 结构化提议（返回 proposal；扩展 Zod/merge 后写 IndexedDB）。
 */
aiRouter.post('/enrichment/complete', async c => {
  return handleEnrichmentComplete(c.req.raw, c.env)
})

/**
 * POST /api/ai/embed
 *
 * Pro 专用：Workers AI bge-m3 向量；扩展异步写本机 clues.embedding。
 */
aiRouter.post('/embed', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleEmbed(c.req.raw, c.env, userId)
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
 * Pro 托管 LLM 文本补全（支持 prompt 或 messages）
 */
aiRouter.post('/hosted/complete', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedComplete(c.req.raw, c.env, userId)
})
