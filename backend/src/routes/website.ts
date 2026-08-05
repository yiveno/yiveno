/**
 * 官网只读 API（Pages → Worker）
 *
 * 登录不经本路由：官网 Supabase Auth 直连。
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { createSupabaseClient } from '../data-access/supabase'
import { error as logErrorMessage, toLogError } from '../utils/logger'

export const websiteRouter = new Hono<{ Bindings: Env }>()

/** GET /api/website/subscription?userId=xxx — 查询用户订阅状态 */
websiteRouter.get('/subscription', async c => {
  try {
    const userId = c.req.query('userId')
    if (!userId) return c.json({ error: '缺少 userId 参数' }, 400)

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

    return c.json({
      tier: data.tier || 'free',
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
