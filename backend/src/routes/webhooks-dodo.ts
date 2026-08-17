/**
 * POST /api/webhooks/dodo — 独立验签，不与其它 webhook 混用。
 */

import { Hono } from 'hono'
import { projectDodoWebhook } from '../services/billing/projection'
import { verifyDodoWebhook } from '../services/billing/dodo-webhook'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

export const dodoWebhookRouter = new Hono<{ Bindings: Env }>()

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
