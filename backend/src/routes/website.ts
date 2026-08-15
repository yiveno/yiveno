/**
 * 官网 API（Pages → Worker）
 *
 * 登录不经本路由：官网 Supabase Auth 直连。
 * 预约名单 POST 公开；订阅查询须 Bearer，且只能查当前用户。
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { getSubscriptionStatusOrThrow } from '../handlers/subscription'
import { handleWebsiteWaitlist } from '../handlers/website-waitlist'
import { supabaseAuth } from '../middleware/supabase-auth'
import { error as logErrorMessage, toLogError } from '../utils/logger'

type WebsiteVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const websiteRouter = new Hono<WebsiteVars>()

/** premium 预留不售：官网展示归一为 free。 */
export function normalizeWebsiteSubscriptionTier(tier: string | null | undefined): 'free' | 'pro' {
  return tier === 'pro' ? 'pro' : 'free'
}

/** POST /api/website/waitlist — 官网预约邮箱（无需登录） */
websiteRouter.post('/waitlist', c => handleWebsiteWaitlist(c.req.raw, c.env))

/** GET /api/website/subscription — 当前登录用户订阅状态（强制对账） */
websiteRouter.get('/subscription', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  try {
    const data = await getSubscriptionStatusOrThrow(c.env, userId, { reconcile: true })
    const tier = normalizeWebsiteSubscriptionTier(data.tier)

    if (!data.isPro) {
      return c.json({ tier: 'free', status: 'inactive' })
    }

    return c.json({
      tier,
      status: data.status,
      currentPeriodStart: null,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd
    })
  } catch (err) {
    logErrorMessage('[website/subscription] error', { detail: toLogError(err) })
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})
