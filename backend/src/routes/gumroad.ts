/**
 * Gumroad 支付路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import type { JWTPayload } from '../middleware/jwt'

export const gumroadRouter = new Hono<{ Bindings: Env }>()

/**
 * GET /api/gumroad/subscription
 *
 * 获取用户订阅信息
 *
 * 需要 JWT 认证
 */
gumroadRouter.get('/subscription', async c => {
  const request = c.req.raw
  const env = c.env

  // JWT payload 由 jwtAuth() 中间件自动注入到 c.get('jwtPayload')
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined

  // 可选：使用 JWT payload 中的用户信息
  if (jwtPayload) {
    console.log('User:', jwtPayload.sub, jwtPayload.email)
  }

  // 按需加载 Gumroad 处理器
  const { handleGetSubscription } = await import('../gumroad-handler')
  return handleGetSubscription(request, env)
})

/**
 * POST /api/gumroad/webhook
 *
 * Gumroad Webhook 回调
 *
 * 需要 JWT 认证
 */
gumroadRouter.post('/webhook', async c => {
  const request = c.req.raw
  const env = c.env

  // 按需加载 Gumroad 处理器
  const { handleWebhook } = await import('../gumroad-handler')
  return handleWebhook(request, env)
})
