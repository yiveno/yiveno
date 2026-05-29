/**
 * AI 路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAIComplete } from '../handlers/ai'

export const aiRouter = new Hono<{ Bindings: Env }>()

/**
 * GET/POST /api/ai/complete
 *
 * AI 文本补全接口
 */
aiRouter.get('/complete', async c => {
  const request = c.req.raw
  const env = c.env

  return handleAIComplete(request, env)
})

aiRouter.post('/complete', async c => {
  const request = c.req.raw
  const env = c.env

  return handleAIComplete(request, env)
})
