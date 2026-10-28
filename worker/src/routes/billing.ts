/**
 * 计费路由：套餐目录、checkout、Customer Portal。
 * 不授 Pro；Pro 只来自已验签的 Dodo webhook / 对账。
 */

import { Hono } from 'hono'
import { createDodoCheckout, createDodoPortalSession } from '../services/billing/dodo-client'
import {
  listPublicPlans,
  parseBillingPlanId,
  resolveDodoProductId
} from '../services/billing/plans'
import { getLatestUserSubscriptionRow } from '../data-access/supabase'
import { getSubscriptionStatusOrThrow } from '../handlers/subscription'
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

function websiteBase(env: Env): string {
  return (env.WEBSITE_URL || '').replace(/\/$/, '') || 'https://yiveno.com'
}

/** GET /api/billing/plans — 公开目录（无 Product ID） */
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

  const productId = resolveDodoProductId(c.env, plan)
  if (!productId) {
    logErrorMessage('[Billing] 套餐未配置 Dodo Product ID', { plan })
    return c.json({ error: 'plan_not_configured' }, 503)
  }

  info('[Billing] checkout-session 开始', { userId, plan })
  // 有效 Pro（含周期结束取消仍在期内）不得再开新单，改走 Customer Portal。
  const entitlement = await getSubscriptionStatusOrThrow(c.env, userId, { reconcile: true })
  if (entitlement.isPro) {
    info('[Billing] 已是有效 Pro，拒绝新 checkout', {
      userId,
      status: entitlement.status,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd
    })
    return c.json({ error: 'already_subscribed' }, 409)
  }

  info('[Billing] 创建 checkout-session', { userId, plan })
  const result = await createDodoCheckout(c.env, {
    userId,
    productId,
    email,
    // 回跳账户页（中性标记）：成败由 Dodo 追加的 status + 投影对账判定；产品致谢归欢迎信
    returnUrl: `${websiteBase(c.env)}/account?checkout=return`
  })
  if (!result.ok) {
    return c.json(
      { error: result.reason === 'not_configured' ? 'dodo_not_configured' : 'checkout_failed' },
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
  const result = await createDodoPortalSession(c.env, customerId, `${websiteBase(c.env)}/account`)
  if (!result.ok) {
    return c.json(
      { error: result.reason === 'not_configured' ? 'dodo_not_configured' : 'portal_failed' },
      result.reason === 'not_configured' ? 503 : 502
    )
  }
  return c.json({ success: true, data: { portalUrl: result.portalUrl } })
})
