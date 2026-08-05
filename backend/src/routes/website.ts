/**
 * 官网只读 API（Pages → Worker）
 *
 * 登录不经本路由：官网 Supabase Auth 直连。
 * 订阅查询须 Bearer，且只能查当前用户（禁止信任 query userId）。
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { createSupabaseClient } from '../data-access/supabase'
import { supabaseAuth } from '../middleware/supabase-auth'
import { error as logErrorMessage, toLogError } from '../utils/logger'

type WebsiteVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
  }
}

export const websiteRouter = new Hono<WebsiteVars>()

/** premium 预留不售：官网展示归一为 free。 */
export function normalizeWebsiteSubscriptionTier(tier: string | null | undefined): 'free' | 'pro' {
  return tier === 'pro' ? 'pro' : 'free'
}

/** GET /api/website/subscription — 当前登录用户订阅状态 */
websiteRouter.get('/subscription', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  try {
    const supabase = createSupabaseClient(c.env)
    if (!supabase) return c.json({ error: '数据库未配置' }, 500)

    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier, status, current_period_start, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      logErrorMessage('[website/subscription] 查询失败', { detail: toLogError(error) })
      return c.json({ error: '查询订阅失败' }, 500)
    }

    if (!data) return c.json({ tier: 'free', status: 'inactive' })

    const tier = normalizeWebsiteSubscriptionTier(data.tier)

    return c.json({
      tier,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end
    })
  } catch (err) {
    logErrorMessage('[website/subscription] error', { detail: toLogError(err) })
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})
