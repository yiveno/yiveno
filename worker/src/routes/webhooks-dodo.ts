/**
 * POST /api/webhooks/dodo — 独立验签，不与其它 webhook 混用。
 */

import { Hono } from 'hono'
import { projectDodoWebhook } from '../services/billing/projection'
import { verifyDodoWebhook } from '../services/billing/dodo-webhook'
import {
  sendProWelcomeEmail,
  shouldSendProWelcomeEmail
} from '../services/billing/pro-welcome-email'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

export const dodoWebhookRouter = new Hono<{ Bindings: Env }>()

/**
 * 发信挂到 waitUntil，避免 Worker 在响应后立刻冻结。
 * 单测 `app.request` 无 ExecutionContext，Hono getter 会抛，此时只 fire-and-forget。
 */
function scheduleProWelcome(
  c: { executionCtx: { waitUntil(promise: Promise<unknown>): void } },
  task: Promise<unknown>
): void {
  try {
    c.executionCtx.waitUntil(task)
  } catch {
    void task
  }
}

dodoWebhookRouter.post('/', async c => {
  const rawBody = await c.req.text()
  const verified = await verifyDodoWebhook(
    c.env.DODO_PAYMENTS_WEBHOOK_KEY,
    {
      id: c.req.header('webhook-id') ?? null,
      timestamp: c.req.header('webhook-timestamp') ?? null,
      signature: c.req.header('webhook-signature') ?? null
    },
    rawBody
  )

  if (!verified.ok) {
    const status = verified.reason === 'not_configured' ? 503 : 401
    return c.json({ error: verified.reason }, status)
  }

  try {
    const result = await projectDodoWebhook(c.env, verified.event, verified.rawBody)
    info('[Billing] webhook 处理完成', {
      eventId: verified.event.eventId,
      eventType: verified.event.eventType,
      outcome: result.outcome,
      reason: result.reason ?? null
    })
    // 投影已成功；欢迎信失败不得把 webhook 打成 5xx（§A.3）
    if (shouldSendProWelcomeEmail(verified.event.eventType, result)) {
      scheduleProWelcome(c, sendProWelcomeEmail(c.env, verified.event))
    }
    return c.json({ success: true, outcome: result.outcome })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] webhook 处理异常', {
      eventId: verified.event.eventId,
      detail
    })
    return c.json({ error: 'Internal server error' }, 500)
  }
})
