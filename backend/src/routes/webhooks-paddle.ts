/**
 * POST /api/webhooks/paddle — 独立验签，不与其它 webhook 混用。
 */

import { Hono } from 'hono'
import { projectPaddleWebhook } from '../services/billing/projection'
import { verifyPaddleWebhook } from '../services/billing/paddle-webhook'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

export const paddleWebhookRouter = new Hono<{ Bindings: Env }>()

paddleWebhookRouter.post('/', async c => {
  const rawBody = await c.req.text()
  const verified = await verifyPaddleWebhook(
    c.env.PADDLE_WEBHOOK_SECRET,
    c.req.header('paddle-signature') ?? null,
    rawBody
  )

  if (!verified.ok) {
    const status = verified.reason === 'not_configured' ? 503 : 401
    return c.json({ error: verified.reason }, status)
  }

  try {
    const result = await projectPaddleWebhook(c.env, verified.event, verified.rawBody)
    info('[Billing] webhook 处理完成', {
      eventId: verified.event.eventId,
      eventType: verified.event.eventType,
      outcome: result.outcome,
      reason: result.reason ?? null
    })
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
