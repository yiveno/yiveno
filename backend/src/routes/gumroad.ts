/**
 * Gumroad 支付路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import type { JWTPayload } from '../middleware/jwt'
import { handleGetSubscription, handleWebhook } from '../handlers/gumroad'

export const gumroadRouter = new Hono<{ Bindings: Env }>()

/** GET /api/gumroad/subscription — 获取用户订阅信息（需要 JWT 认证） */
gumroadRouter.get('/subscription', c => {
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined
  if (jwtPayload) {
    console.log('User:', jwtPayload.sub, jwtPayload.email)
  }
  return handleGetSubscription(c.req.raw, c.env, c.req.header('origin') ?? null)
})

/** POST /api/gumroad/webhook — Gumroad Webhook 回调（需要 JWT 认证） */
gumroadRouter.post('/webhook', c => {
  return handleWebhook(c.req.raw, c.env, c.req.header('origin') ?? null)
})
