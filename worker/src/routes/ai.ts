/**
 * AI 路由
 *
 * - `/clue/complete`：开发/未登录降级路径（IP 日配额；正式 Pro 走 hosted）
 * - `/enrichment/complete`：Capture enrichment 结构化提议（扩展 merge 后写库）
 * - `/gs-clue-samples/complete`：Getting Started 示意 clue（一次 4 条；IP 日配额）
 * - `/hosted/*`：托管口语 LLM（Bearer + 月配额；扩展已接线）
 * - `/dreaming/complete`：夜间命题批量编译（Bearer；独立 dreaming 配额；peek-then-commit）
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleClueComplete } from '../handlers/ai-clue'
import { handleEmbed } from '../handlers/ai-embed'
import { handleEnrichmentComplete } from '../handlers/ai-enrichment'
import { handleGsClueSamplesComplete } from '../handlers/ai-gs-clue-samples'
import { handleDreamingComplete } from '../handlers/ai-dreaming'
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
 * POST /api/ai/gs-clue-samples/complete
 *
 * Getting Started：一次生成 4 条口语示意 clue（返回 JSON；扩展缓存后展示）。
 */
aiRouter.post('/gs-clue-samples/complete', async c => {
  return handleGsClueSamplesComplete(c.req.raw, c.env)
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

/**
 * POST /api/ai/dreaming/complete
 *
 * 夜间命题批量编译（登录 Free/Pro；独立配额；成功才扣费）。
 */
aiRouter.post('/dreaming/complete', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleDreamingComplete(c.req.raw, c.env, userId)
})
