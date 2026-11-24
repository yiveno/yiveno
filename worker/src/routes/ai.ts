/**
 * AI 路由
 *
 * - `/clue/complete`：开发/未登录降级路径（IP 日配额；正式 Pro 走 hosted）
 * - `/enrichment/complete`：Capture enrichment（双栈 Bearer；用户+IP 日配额）
 * - `/gs-clue-samples/complete`：Getting Started 示意 clue（双栈 Bearer 含匿名；用户+IP 日配额）
 * - `/hosted/*`：托管口语 LLM（双栈 Bearer + 月/终身配额；[system,user] + system 指纹）
 * - `/dreaming/complete`：夜间命题批量编译（双栈 Bearer；匿名 403）
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleClueComplete } from '../handlers/ai-clue'
import { handleEmbed } from '../handlers/ai-embed'
import { handleEnrichmentComplete } from '../handlers/ai-enrichment'
import { handleGsClueSamplesComplete } from '../handlers/ai-gs-clue-samples'
import { handleDreamingComplete } from '../handlers/ai-dreaming'
import { handleHostedComplete, handleHostedQuota } from '../handlers/ai-hosted'
import { deviceAuthOrSupabaseAuth } from '../middleware/device-or-supabase-auth'

interface AiRouteEnv {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
    deviceIsAnonymous: boolean
  }
}

function readIsAnonymous(c: { get: (key: 'deviceIsAnonymous') => boolean | undefined }): boolean {
  return c.get('deviceIsAnonymous') === true
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
 * 双栈 Bearer；用户日配额 + IP 日配额双道。
 */
aiRouter.post('/enrichment/complete', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleEnrichmentComplete(c.req.raw, c.env, userId, readIsAnonymous(c))
})

/**
 * POST /api/ai/gs-clue-samples/complete
 *
 * Getting Started：一次生成 4 条口语示意 clue（返回 JSON；扩展缓存后展示）。
 * 双栈 Bearer（含匿名）；用户日配额 + IP 日配额双道。
 */
aiRouter.post('/gs-clue-samples/complete', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleGsClueSamplesComplete(c.req.raw, c.env, userId, readIsAnonymous(c))
})

/**
 * POST /api/ai/embed
 *
 * Workers AI bge-m3；双栈鉴权；匿名终身 30 次调用。
 */
aiRouter.post('/embed', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleEmbed(c.req.raw, c.env, userId, readIsAnonymous(c))
})

/**
 * GET /api/ai/hosted/quota
 *
 * 托管 LLM 配额查询（含匿名终身档）
 */
aiRouter.get('/hosted/quota', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedQuota(c.req.raw, c.env, userId, readIsAnonymous(c))
})

/**
 * POST /api/ai/hosted/complete
 *
 * 托管 LLM 文本补全（须 [system, user]；taskKind 闭集 nlu/framing_nlg/follow_up_nlg/narrow_polish）
 */
aiRouter.post('/hosted/complete', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleHostedComplete(c.req.raw, c.env, userId, readIsAnonymous(c))
})

/**
 * POST /api/ai/dreaming/complete
 *
 * 夜间命题批量编译；匿名 403。
 */
aiRouter.post('/dreaming/complete', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  return handleDreamingComplete(c.req.raw, c.env, userId, readIsAnonymous(c))
})
