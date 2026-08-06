/**
 * 将投影与 Gumroad subscriber 对齐（§A.3.2）
 */

import type { Subscription } from '@yiveno/types'
import {
  getLatestUserSubscriptionRow,
  listSubscriptionsNeedingVerify,
  upsertSubscription
} from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { info, error as logErrorMessage, warn } from '../../utils/logger'
import { ENTITLEMENT_VERIFY_TTL_MS } from './entitlement-policy'
import { isFakeGumroadSubscriptionId } from './subscription-id'
import {
  fetchGumroadSubscriber,
  isGumroadSubscriberAlive,
  type FetchSubscriberResult
} from './subscriber-api'

export type ReconcileOutcome = {
  /** 对账后是否有效 Pro */
  isPro: boolean
  /** Gumroad API 是否失败（含未配置） */
  apiFailed: boolean
  subscription: Subscription | null
  reason: string
}

function expireNowPatch(
  row: Subscription,
  gumroadStatus: string,
  verificationStatus: 'mismatch' | 'verified'
): Partial<Subscription> {
  const nowIso = new Date().toISOString()
  return {
    user_id: row.user_id,
    gumroad_subscription_id: row.gumroad_subscription_id ?? null,
    gumroad_order_id: row.gumroad_order_id ?? null,
    gumroad_variant_id: row.gumroad_variant_id ?? null,
    status: 'expired',
    tier: row.tier === 'pro' || row.tier === 'premium' ? row.tier : 'pro',
    current_period_start: row.current_period_start,
    current_period_end: nowIso,
    cancel_at_period_end: false,
    cancelled_at: nowIso,
    source: 'gumroad_verify',
    last_verified_at: nowIso,
    verification_status: verificationStatus,
    gumroad_subscriber_status: gumroadStatus
  }
}

function activateAlivePatch(row: Subscription, gumroadStatus: string): Partial<Subscription> {
  const nowIso = new Date().toISOString()
  const periodEnd =
    row.current_period_end && Date.parse(row.current_period_end) > Date.now()
      ? row.current_period_end
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  return {
    user_id: row.user_id,
    gumroad_subscription_id: row.gumroad_subscription_id ?? null,
    gumroad_order_id: row.gumroad_order_id ?? null,
    gumroad_variant_id: row.gumroad_variant_id ?? null,
    status: 'active',
    tier: 'pro',
    current_period_start: row.current_period_start || nowIso,
    current_period_end: periodEnd,
    cancel_at_period_end: row.cancel_at_period_end ?? false,
    cancelled_at: null,
    source: 'gumroad_verify',
    last_verified_at: nowIso,
    verification_status: 'verified',
    gumroad_subscriber_status: gumroadStatus
  }
}

async function applyFetchResult(
  env: Env,
  row: Subscription,
  fetched: FetchSubscriberResult
): Promise<ReconcileOutcome> {
  if (fetched.ok === false) {
    if (fetched.reason === 'not_found') {
      const expired = await upsertSubscription(env, expireNowPatch(row, 'not_found', 'mismatch'))
      info('[GumroadReconcile] subscriber 不存在，已降级', {
        userId: row.user_id,
        gumroadSubscriptionId: row.gumroad_subscription_id
      })
      return { isPro: false, apiFailed: false, subscription: expired, reason: 'not_found' }
    }
    warn('[GumroadReconcile] API 不可用', {
      userId: row.user_id,
      reason: fetched.reason,
      detail: fetched.detail
    })
    return {
      isPro: false,
      apiFailed: true,
      subscription: row,
      reason: fetched.reason
    }
  }

  const status = fetched.subscriber.status
  if (!isGumroadSubscriberAlive(status)) {
    const expired = await upsertSubscription(env, expireNowPatch(row, status, 'verified'))
    info('[GumroadReconcile] 非 alive，立刻降级', {
      userId: row.user_id,
      gumroadStatus: status
    })
    return { isPro: false, apiFailed: false, subscription: expired, reason: `ended:${status}` }
  }

  const activated = await upsertSubscription(env, activateAlivePatch(row, status))
  info('[GumroadReconcile] alive，已对齐 Pro', { userId: row.user_id })
  return { isPro: true, apiFailed: false, subscription: activated, reason: 'alive' }
}

/**
 * 对指定用户强制对账；无订阅行 → Free。
 * 假订阅 ID → 立刻 mismatch 降级。
 */
export async function reconcileUserSubscription(
  env: Env,
  userId: string
): Promise<ReconcileOutcome> {
  const row = await getLatestUserSubscriptionRow(env, userId)
  if (!row) {
    return { isPro: false, apiFailed: false, subscription: null, reason: 'no_row' }
  }

  const subId = row.gumroad_subscription_id
  if (isFakeGumroadSubscriptionId(subId)) {
    const expired = await upsertSubscription(
      env,
      expireNowPatch(row, 'revoked_test_id', 'mismatch')
    )
    info('[GumroadReconcile] 假订阅 ID，已降级', { userId })
    return { isPro: false, apiFailed: false, subscription: expired, reason: 'fake_id' }
  }

  const accessToken = (env as Env & { GUMROAD_ACCESS_TOKEN?: string }).GUMROAD_ACCESS_TOKEN
  const fetched = await fetchGumroadSubscriber(accessToken, subId!)
  return applyFetchResult(env, row, fetched)
}

/**
 * Cron：扫过期 verified 的 active 行并逐一对账。
 */
export async function reconcileStaleActiveSubscriptions(env: Env): Promise<{
  scanned: number
  degraded: number
  errors: number
}> {
  const olderThanIso = new Date(Date.now() - ENTITLEMENT_VERIFY_TTL_MS).toISOString()
  const rows = await listSubscriptionsNeedingVerify(env, olderThanIso, 50)
  let degraded = 0
  let errors = 0

  info('[GumroadReconcile] 开始批量对账', { scanned: rows.length, olderThanIso })

  for (const row of rows) {
    try {
      if (!row.user_id) continue
      if (isFakeGumroadSubscriptionId(row.gumroad_subscription_id)) {
        await upsertSubscription(env, expireNowPatch(row, 'revoked_test_id', 'mismatch'))
        degraded++
        continue
      }
      const accessToken = (env as Env & { GUMROAD_ACCESS_TOKEN?: string }).GUMROAD_ACCESS_TOKEN
      const fetched = await fetchGumroadSubscriber(accessToken, row.gumroad_subscription_id!)
      const outcome = await applyFetchResult(env, row, fetched)
      if (!outcome.isPro && !outcome.apiFailed) {
        degraded++
      }
      if (outcome.apiFailed) {
        errors++
      }
    } catch (err) {
      errors++
      logErrorMessage('[GumroadReconcile] 单行对账异常', {
        userId: row.user_id,
        detail: err instanceof Error ? err.message : String(err)
      })
    }
  }

  info('[GumroadReconcile] 批量对账结束', {
    scanned: rows.length,
    degraded,
    errors
  })
  return { scanned: rows.length, degraded, errors }
}
