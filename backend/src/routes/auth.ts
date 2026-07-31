/**
 * 认证路由
 *
 * Phase C / Pro 预留：当前扩展与官网未接线。
 * 官网登录走 Supabase Auth 直连，不经过本路由。
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAuthProviders, handleAuthStart, handleAuthCallback } from '../handlers/auth'

export const authRouter = new Hono<{ Bindings: Env }>()

/**
 * GET /api/auth/providers
 *
 * 获取可用的 OAuth 提供商列表
 */
authRouter.get('/providers', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  return handleAuthProviders(request, env, origin)
})

/**
 * GET /api/auth/start
 *
 * 开始 OAuth 认证流程
 */
authRouter.get('/start', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  return handleAuthStart(request, env, origin)
})

/**
 * GET /api/auth/callback
 *
 * OAuth 认证回调
 */
authRouter.get('/callback', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  return handleAuthCallback(request, env, origin)
})
