/**
 * 账户路由：删除账号、订阅状态等（Supabase Auth Bearer）。
 */

import { Hono } from 'hono'

import { deleteAccountForOwner } from '../data-access/account-delete'
import { getSubscriptionStatusOrThrow } from '../handlers/subscription'
import { supabaseAuth } from '../middleware/supabase-auth'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

type AccountVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const accountRouter = new Hono<AccountVars>()

accountRouter.use('*', supabaseAuth())

/**
 * GET /api/account/subscription
 * 扩展主路径：当前用户是否 Pro（与 memory sync 同一 Bearer）。
 */
accountRouter.get('/subscription', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const data = await getSubscriptionStatusOrThrow(c.env, userId)
    info('[Account] 查询订阅', { userId, isPro: data.isPro, tier: data.tier })
    return c.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Account] subscription 异常', { detail: msg, userId })
    return c.json(
      {
        error: msg === 'subscription_status_failed' ? msg : 'subscription_status_failed'
      },
      500
    )
  }
})

/**
 * POST /api/account/delete
 * 删除云端 Memory/backups 并注销 Auth 用户（不可恢复）。
 */
accountRouter.post('/delete', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const result = await deleteAccountForOwner(c.env, userId)
    return c.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Account] delete 异常', { detail: msg, userId })
    return c.json(
      {
        error:
          msg === 'supabase_not_configured' || msg === 'account_delete_failed'
            ? msg
            : 'account_delete_failed'
      },
      500
    )
  }
})
