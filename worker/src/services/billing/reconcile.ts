/**
 * 将投影与 Dodo subscription 对齐（§A.3.2）
 */

import type { Subscription } from '@yiveno/types'
import {
  getLatestUserSubscriptionRow,
  listSubscriptionsNeedingVerify,
  upsertSubscription
} from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import { ENTITLEMENT_VERIFY_TTL_MS } from './entitlement-policy'
import {
  expireSubscriptionPatch,
  isDodoAccessActive,
  snapshotToSubscriptionRecord
} from './normalize'
import { fetchDodoSubscription } from './dodo-client'
import { isFakeProviderSubscriptionId } from './subscription-id'

export type ReconcileOutcome = {
  /** 对账后是否有效 Pro */
  isPro: boolean
  /** Dodo API 是否失败（含未配置） */
  apiFailed: boolean
  subscription: Subscription | null
  reason: string
}

async function applyFetchResult(
  env: Env,
  row: Subscription,
  fetched: Awaited<ReturnType<typeof fetchDodoSubscription>>
): Promise<ReconcileOutcome> {
  if (fetched.ok === false) {
    if (fetched.reason === 'not_found') {
      const expired = await upsertSubscription(
        env,
        expireSubscriptionPatch(row, 'not_found', 'mismatch')
      )
      info('[BillingReconcile] subscription 不存在，已降级', {
        userId: row.user_id,
        providerSubscriptionId: row.provider_subscription_id
      })
      return { isPro: false, apiFailed: false, subscription: expired, reason: 'not_found' }
    }
    warn('[BillingReconcile] API 不可用', {
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

  const record = snapshotToSubscriptionRecord(fetched.subscription, row.user_id, 'dodo_verify')
  if (!isDodoAccessActive(record.status ?? 'expired')) {
    const expired = await upsertSubscription(
      env,
      expireSubscriptionPatch(row, fetched.subscription.status, 'verified')
    )
    info('[BillingReconcile] 非 active，立刻降级', {
      userId: row.user_id,
      dodoStatus: fetched.subscription.status
    })
    return {
      isPro: false,
      apiFailed: false,
      subscription: expired,
      reason: `ended:${fetched.subscription.status}`
    }
  }

  // 全额退款已 expire 时：Dodo 订阅若尚未 cancel，不得对账刷回 Pro
  if (row.status === 'expired' && row.provider_status === 'refunded') {
    info('[BillingReconcile] 本地已因退款 expire，忽略 Dodo 仍 active', {
      userId: row.user_id,
      providerSubscriptionId: row.provider_subscription_id
    })
    return {
      isPro: false,
      apiFailed: false,
      subscription: row,
      reason: 'refunded_local'
    }
  }

  const activated = await upsertSubscription(env, record)
  info('[BillingReconcile] active，已对齐 Pro', { userId: row.user_id })
  return { isPro: true, apiFailed: false, subscription: activated, reason: 'active' }
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

  const subId = row.provider_subscription_id
  if (isFakeProviderSubscriptionId(subId)) {
    const expired = await upsertSubscription(
      env,
      expireSubscriptionPatch(row, 'revoked_test_id', 'mismatch')
    )
    info('[BillingReconcile] 假订阅 ID，已降级', { userId })
    return { isPro: false, apiFailed: false, subscription: expired, reason: 'fake_id' }
  }

  const fetched = await fetchDodoSubscription(env, subId!)
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

  info('[BillingReconcile] 开始批量对账', { scanned: rows.length, olderThanIso })

  for (const row of rows) {
    try {
      if (!row.user_id) continue
      if (isFakeProviderSubscriptionId(row.provider_subscription_id)) {
        await upsertSubscription(env, expireSubscriptionPatch(row, 'revoked_test_id', 'mismatch'))
        degraded++
        continue
      }
      const fetched = await fetchDodoSubscription(env, row.provider_subscription_id!)
      const outcome = await applyFetchResult(env, row, fetched)
      if (!outcome.isPro && !outcome.apiFailed) {
        degraded++
      }
      if (outcome.apiFailed) {
        errors++
      }
    } catch (err) {
      errors++
      logErrorMessage('[BillingReconcile] 单行对账异常', {
        userId: row.user_id,
        detail: err instanceof Error ? err.message : String(err)
      })
    }
  }

  info('[BillingReconcile] 批量对账结束', {
    scanned: rows.length,
    degraded,
    errors
  })
  return { scanned: rows.length, degraded, errors }
}
