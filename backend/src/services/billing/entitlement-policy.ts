/**
 * 订阅权益新鲜度策略（产品文档 §A.3.2）
 */

/** 敏感门禁对账新鲜度：24h */
export const ENTITLEMENT_VERIFY_TTL_MS = 24 * 60 * 60 * 1000

/** Paddle API 故障宽限：48h（仅维持已 verified，不新授） */
export const ENTITLEMENT_VERIFY_GRACE_MS = 48 * 60 * 60 * 1000

export type FreshnessDecision =
  | 'fresh' // 24h 内已 verified，可直接放行
  | 'reconcile' // 需对账
  | 'grace_ok' // API 失败但在 48h grace 内且曾 verified
  | 'deny' // mismatch / 过期 / 不可信

/**
 * 根据 last_verified_at / verification_status 决定门禁动作。
 * @param apiFailed 本次对账是否因 Paddle API 失败
 */
export function decideEntitlementFreshness(input: {
  verificationStatus: string | null | undefined
  lastVerifiedAt: string | null | undefined
  nowMs?: number
  apiFailed?: boolean
}): FreshnessDecision {
  const now = input.nowMs ?? Date.now()
  const status = input.verificationStatus || 'unverified'

  if (status === 'mismatch') {
    return 'deny'
  }

  const verifiedAtMs = input.lastVerifiedAt ? Date.parse(input.lastVerifiedAt) : NaN
  const hasVerifiedAt = !Number.isNaN(verifiedAtMs)
  const ageMs = hasVerifiedAt ? now - verifiedAtMs : Number.POSITIVE_INFINITY

  if (input.apiFailed) {
    if (status === 'verified' && hasVerifiedAt && ageMs <= ENTITLEMENT_VERIFY_GRACE_MS) {
      return 'grace_ok'
    }
    return 'deny'
  }

  if (status === 'verified' && hasVerifiedAt && ageMs <= ENTITLEMENT_VERIFY_TTL_MS) {
    return 'fresh'
  }

  return 'reconcile'
}
