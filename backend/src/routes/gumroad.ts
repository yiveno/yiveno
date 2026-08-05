/**
 * Gumroad 支付路由
 *
 * webhook 必须对 Gumroad 公开（仅 seller_id 校验）。
 * GET /subscription 为历史 JWT 查询（扩展/官网主路径已改用 `/api/account/subscription`）。
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import type { JWTPayload } from '../middleware/jwt'
import { jwtAuth } from '../middleware/jwt'
import { handleGetSubscription, handleWebhook } from '../handlers/gumroad'
import { info } from '../utils/logger'

export const gumroadRouter = new Hono<{ Bindings: Env }>()

/** GET /api/gumroad/subscription — 历史 JWT 查询（主路径请用 GET /api/account/subscription） */
gumroadRouter.get('/subscription', jwtAuth(), c => {
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined
  const userId = jwtPayload?.sub?.trim() ?? ''
  if (!userId) {
    return c.json({ error: 'missing_subject' }, 401)
  }

  info('[Gumroad] 查询订阅', {
    sub: userId,
    email: jwtPayload?.email
  })

  return handleGetSubscription(c.req.raw, c.env, c.req.header('origin') ?? null, userId)
})

/** POST /api/gumroad/webhook — Gumroad 回调（无 JWT；seller_id 校验） */
gumroadRouter.post('/webhook', c => {
  return handleWebhook(c.req.raw, c.env, c.req.header('origin') ?? null)
})
