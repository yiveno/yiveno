/**
 * 健康检查路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const healthRouter = new Hono<{ Bindings: Env }>()

/**
 * GET /health
 * GET /api/health
 *
 * 返回服务健康状态
 */
healthRouter.get('/health', c => {
  return c.json({
    status: 'ok',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString()
  })
})

healthRouter.get('/api/health', c => {
  return c.json({
    status: 'ok',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString()
  })
})
