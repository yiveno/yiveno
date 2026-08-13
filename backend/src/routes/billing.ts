/**
 * 计费路由：套餐目录、checkout、Customer Portal。
 * 不授 Pro；Pro 只来自已验签的 Paddle webhook / 对账。
 */

import { Hono } from 'hono'
import { createPaddleCheckout, createPaddlePortalSession } from '../services/billing/paddle-client'
import {
  listPublicPlans,
  parseBillingPlanId,
  resolvePaddlePriceId
} from '../services/billing/plans'
import { getLatestUserSubscriptionRow } from '../data-access/supabase'
import { supabaseAuth } from '../middleware/supabase-auth'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

type BillingVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const billingRouter = new Hono<BillingVars>()

/** GET /api/billing/plans — 公开目录（无 Price ID） */
billingRouter.get('/plans', c => {
  return c.json({ success: true, data: { plans: listPublicPlans(c.env) } })
})

billingRouter.use('/checkout-session', supabaseAuth())
billingRouter.use('/portal-session', supabaseAuth())

/** POST /api/billing/checkout-session */
billingRouter.post('/checkout-session', async c => {
  const userId = c.get('supabaseUserId')
  const email = c.get('supabaseUserEmail')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }
  const planRaw =
    body && typeof body === 'object' && 'plan' in body ? (body as { plan: unknown }).plan : null
  const plan = parseBillingPlanId(planRaw, c.env)
  if (!plan) {
    return c.json({ error: 'invalid_plan' }, 400)
  }

  const priceId = resolvePaddlePriceId(c.env, plan)
  if (!priceId) {
    logErrorMessage('[Billing] 套餐未配置 Paddle Price ID', { plan })
    return c.json({ error: 'plan_not_configured' }, 503)
  }

  info('[Billing] 创建 checkout-session', { userId, plan })
  const result = await createPaddleCheckout(c.env, { userId, priceId, email })
  if (!result.ok) {
    return c.json(
      { error: result.reason === 'not_configured' ? 'paddle_not_configured' : 'checkout_failed' },
      result.reason === 'not_configured' ? 503 : 502
    )
  }
  return c.json({ success: true, data: { checkoutUrl: result.checkoutUrl } })
})

/** POST /api/billing/portal-session */
billingRouter.post('/portal-session', async c => {
  const userId = c.get('supabaseUserId')
  const row = await getLatestUserSubscriptionRow(c.env, userId)
  const customerId = row?.provider_customer_id?.trim()
  if (!customerId) {
    return c.json({ error: 'no_customer' }, 404)
  }

  info('[Billing] 创建 portal-session', { userId })
  const result = await createPaddlePortalSession(c.env, customerId)
  if (!result.ok) {
    return c.json(
      { error: result.reason === 'not_configured' ? 'paddle_not_configured' : 'portal_failed' },
      result.reason === 'not_configured' ? 503 : 502
    )
  }
  return c.json({ success: true, data: { portalUrl: result.portalUrl } })
})
