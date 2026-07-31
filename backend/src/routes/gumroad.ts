/**
 * Gumroad 支付路由
 *
 * Phase C / Pro 预留：当前扩展与官网未接线。
 * webhook 必须对 Gumroad 公开（仅 seller_id 校验）；subscription 需 JWT。
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import type { JWTPayload } from '../middleware/jwt'
import { jwtAuth } from '../middleware/jwt'
import { handleGetSubscription, handleWebhook } from '../handlers/gumroad'
import { info } from '../utils/logger'

export const gumroadRouter = new Hono<{ Bindings: Env }>()

/** GET /api/gumroad/subscription — 获取用户订阅信息（需要 JWT） */
gumroadRouter.get('/subscription', jwtAuth(), c => {
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined
  if (jwtPayload) {
    info('User', {
      sub: jwtPayload.sub,
      email: jwtPayload.email
    })
  }
  return handleGetSubscription(c.req.raw, c.env, c.req.header('origin') ?? null)
})

/** POST /api/gumroad/webhook — Gumroad 回调（无 JWT；seller_id 校验） */
gumroadRouter.post('/webhook', c => {
  return handleWebhook(c.req.raw, c.env, c.req.header('origin') ?? null)
})
