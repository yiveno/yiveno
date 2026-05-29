/**
 * Hono 应用主入口
 *
 * 使用 Hono 框架构建的 Cloudflare Worker 应用
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import type { Env } from './types/env'
import { ALLOWED_ORIGINS } from './middleware/cors'
import { logRequest, logResponse, logError } from './utils/logger'
import { secureHeadersMiddleware } from './middleware/secure-headers'
import { jwtAuth } from './middleware/jwt'

// 导入路由
import { healthRouter } from './routes/health'
import { adminRouter } from './routes/admin'
import { authRouter } from './routes/auth'
import { aiRouter } from './routes/ai'
import { gumroadRouter } from './routes/gumroad'
import { trpcRouter } from './routes/trpc'

/**
 * 创建 Hono 应用实例
 */
export function createApp() {
  const app = new Hono<{ Bindings: Env }>()

  // ===================== 全局中间件 =====================

  /**
   * 安全响应头中间件
   *
   * 添加安全响应头（X-Content-Type-Options, X-Frame-Options 等）
   */
  app.use('*', secureHeadersMiddleware())

  /**
   * CORS 中间件
   *
   * 安全策略：只允许特定域名访问 API
   */
  app.use(
    '*',
    cors({
      origin: origin => {
        // Chrome Extension 的 origin 格式：chrome-extension://extension-id
        const isChromeExtension = origin.startsWith('chrome-extension://')

        // 检查是否为允许的来源
        if (ALLOWED_ORIGINS.includes(origin) || isChromeExtension) {
          return origin
        }

        // 不允许的来源：返回 null（浏览器会阻止请求）
        return null
      },
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization'],
      credentials: true,
      maxAge: 86400 // 24 小时
    })
  )

  /**
   * 日志中间件
   *
   * 记录所有请求和响应
   */
  app.use(
    '*',
    honoLogger(message => {
      console.log(message)
    })
  )

  /**
   * 自定义日志中间件
   *
   * 使用项目的日志工具记录详细信息
   */
  app.use('*', async (c, next) => {
    const startTime = Date.now()
    const request = c.req.raw

    logRequest(request)

    try {
      await next()

      const response = c.res
      logResponse(request, response, Date.now() - startTime)
    } catch (err) {
      logError(err, {
        method: request.method,
        path: new URL(request.url).pathname,
        duration: Date.now() - startTime
      })
      throw err
    }
  })

  // ===================== 路由注册 =====================

  /**
   * 健康检查路由
   *
   * GET /health
   * GET /api/health
   */
  app.route('/', healthRouter)

  /**
   * 管理员路由（需要 JWT 认证）
   *
   * GET /api/admin/env/check
   */
  app.use('/api/admin/*', jwtAuth())
  app.route('/api/admin', adminRouter)

  /**
   * 认证路由
   *
   * GET /api/auth/providers
   * GET /api/auth/start
   * GET /api/auth/callback
   */
  app.route('/api/auth', authRouter)

  /**
   * AI 路由
   *
   * GET/POST /api/ai/complete
   */
  app.route('/api/ai', aiRouter)

  /**
   * Gumroad 支付路由（需要 JWT 认证）
   *
   * GET /api/gumroad/subscription
   * POST /api/gumroad/webhook
   */
  app.use('/api/gumroad/*', jwtAuth())
  app.route('/api/gumroad', gumroadRouter)

  /**
   * tRPC 路由
   *
   * ALL /trpc/*
   */
  app.route('/trpc', trpcRouter)

  // ===================== 404 处理 =====================

  /**
   * 404 Not Found
   */
  app.notFound(c => {
    return c.json({ error: 'Not Found' }, 404)
  })

  // ===================== 错误处理 =====================

  /**
   * 全局错误处理
   */
  app.onError((err, c) => {
    console.error('❌ Unhandled error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  return app
}
