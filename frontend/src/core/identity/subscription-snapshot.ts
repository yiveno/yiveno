import { z } from 'zod'

/**
 * 订阅层级（与云端 subscriptions.tier 对齐）。
 * - free：免费
 * - pro：Pro
 * - premium：Premium（预留）
 */
export const SubscriptionTierSchema = z.enum([
  'free', // 免费
  'pro', // Pro
  'premium' // Premium
])

/**
 * 订阅状态。
 * - inactive：无有效订阅
 * - active：有效
 * - past_due：逾期
 * - cancelled：已取消
 * - expired：已过期
 * - paused：已暂停
 */
export const SubscriptionStatusSchema = z.enum([
  'inactive', // 无订阅
  'active', // 有效
  'past_due', // 逾期
  'cancelled', // 已取消
  'expired', // 已过期
  'paused' // 已暂停
])

/** 扩展本地缓存的订阅快照（chrome.storage.local）。 */
export const SubscriptionSnapshotSchema = z.object({
  isPro: z.boolean(),
  tier: SubscriptionTierSchema,
  status: SubscriptionStatusSchema,
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  /** 上次成功拉取时间（ISO）。 */
  fetchedAt: z.string().datetime()
})

export type SubscriptionSnapshot = z.infer<typeof SubscriptionSnapshotSchema>

export const SUBSCRIPTION_SNAPSHOT_STORAGE_KEY = 'yiveno.subscriptionSnapshot'

/** 未登录 / 拉取失败时的默认 Free 快照。 */
export function createFreeSubscriptionSnapshot(
  nowIso = new Date().toISOString()
): SubscriptionSnapshot {
  return {
    isPro: false,
    tier: 'free',
    status: 'inactive',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    fetchedAt: nowIso
  }
}
