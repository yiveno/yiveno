/**
 * Cloudflare Worker 主入口
 *
 * 使用 Hono 框架构建的高性能 API
 */

import { createApp } from './app'
import { handleScheduledCleanup } from './handlers/scheduled-cleanup'
import { handleScheduledSubscriptionReconcile } from './handlers/scheduled-subscription-reconcile'
import type { Env } from './types/env'

/**
 * 创建 Hono 应用实例
 */
const app = createApp()

/** 小时对账 cron（wrangler triggers.crons） */
const SUBSCRIPTION_RECONCILE_CRON = '7 * * * *'

/**
 * 导出 Cloudflare Worker 处理器
 */
export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (controller.cron === SUBSCRIPTION_RECONCILE_CRON) {
      ctx.waitUntil(handleScheduledSubscriptionReconcile(controller, env))
      return
    }
    ctx.waitUntil(handleScheduledCleanup(controller, env))
  }
}
