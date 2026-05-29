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

import { healthRouter } from './routes/health'
import { adminRouter } from './routes/admin'
import { authRouter } from './routes/auth'
import { aiRouter } from './routes/ai'
import { gumroadRouter } from './routes/gumroad'
import { trpcRouter } from './routes/trpc'

/** 创建 Hono 应用实例 */
export function createApp() {
  const app = new Hono<{ Bindings: Env }>()

  // ===== 全局中间件 =====
  app.use('*', secureHeadersMiddleware())

  app.use(
    '*',
    cors({
      origin: origin => {
        const isChromeExtension = origin.startsWith('chrome-extension://')
        if (ALLOWED_ORIGINS.includes(origin) || isChromeExtension) {
          return origin
        }
        return null
      },
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization'],
      credentials: true,
      maxAge: 86400
    })
  )

  app.use(
    '*',
    honoLogger(message => {
      console.log(message)
    })
  )

  app.use('*', async (c, next) => {
    const startTime = Date.now()
    const request = c.req.raw
    logRequest(request)
    try {
      await next()
      logResponse(request, c.res, Date.now() - startTime)
    } catch (err) {
      logError(err, {
        method: request.method,
        path: new URL(request.url).pathname,
        duration: Date.now() - startTime
      })
      throw err
    }
  })

  // ===== 路由注册 =====
  app.route('/', healthRouter)

  app.use('/api/admin/*', jwtAuth())
  app.route('/api/admin', adminRouter)

  app.route('/api/auth', authRouter)
  app.route('/api/ai', aiRouter)

  app.use('/api/gumroad/*', jwtAuth())
  app.route('/api/gumroad', gumroadRouter)

  app.route('/trpc', trpcRouter)

  // ===== 错误处理 =====
  app.notFound(c => c.json({ error: 'Not Found' }, 404))

  app.onError((err, c) => {
    console.error('❌ Unhandled error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  return app
}
