/**
 * Hono 应用主入口
 *
 * 使用 Hono 框架构建的 Cloudflare Worker 应用
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { Env } from './types/env'
import { ALLOWED_ORIGINS } from './middleware/cors'
import { logRequest, logResponse, logError } from './utils/logger'
import { secureHeadersMiddleware } from './middleware/secure-headers'

import { healthRouter } from './routes/health'
import { authRouter } from './routes/auth'
import { aiRouter } from './routes/ai'
import { billingRouter } from './routes/billing'
import { dodoWebhookRouter } from './routes/webhooks-dodo'
import { accountRouter } from './routes/account'
import { memorySyncRouter } from './routes/memory-sync'
import { mcpRouter } from './routes/mcp'
import { researchRouter } from './routes/research'
import { websiteRouter } from './routes/website'
import { evalRouter } from './routes/eval'

type AppVariables = {
  /** 日志中间件生成；onError 写入 500 响应体便于扩展侧关联 */
  requestId: string
}

/** 创建 Hono 应用实例 */
export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

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
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization'],
      credentials: true,
      maxAge: 86400
    })
  )

  app.use('*', async (c, next) => {
    const startTime = Date.now()
    const request = c.req.raw
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID()
    c.set('requestId', requestId)
    c.header('x-request-id', requestId)

    logRequest(request, { requestId })
    try {
      await next()
      logResponse(request, c.res, Date.now() - startTime, { requestId })
    } catch (err) {
      logError(err, {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        duration: Date.now() - startTime
      })
      throw err
    }
  })

  // ===== 路由注册 =====
  app.route('/', healthRouter)

  app.route('/api/auth', authRouter)
  app.route('/api/eval', evalRouter)
  app.route('/api/ai', aiRouter)

  // Phase C：Cloud Memory 同步（Supabase Auth Bearer）
  app.route('/api/memory/sync', memorySyncRouter)

  // 暗线研究：匿名汇总草图接收端（Supabase Auth Bearer · 无 Pro 门禁）
  app.route('/api/research', researchRouter)

  // 账户：删除账号等（Supabase Auth Bearer）
  app.route('/api/account', accountRouter)

  // 只读 MCP beta（Supabase Auth Bearer + KV 门禁）
  app.route('/api/mcp', mcpRouter)

  app.route('/api/billing', billingRouter)
  app.route('/api/webhooks/dodo', dodoWebhookRouter)

  app.route('/api/website', websiteRouter)

  // ===== 错误处理 =====
  app.notFound(c => c.json({ error: 'Not Found' }, 404))

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse()
    }
    const requestId = c.get('requestId')
    logError(err, { path: c.req.path, method: c.req.method, requestId })
    return c.json(
      {
        error: 'Internal Server Error',
        ...(typeof requestId === 'string' && requestId ? { requestId } : {})
      },
      500
    )
  })

  return app
}
