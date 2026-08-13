/**
 * Paddle 订阅 ID / Yiveno user_id 硬门槛
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Paddle Billing subscription id：sub_ + 26 位 */
const PADDLE_SUB_RE = /^sub_[a-z0-9]{26}$/i

/** 是否为可接受的 Yiveno user_id（Supabase Auth UUID） */
export function isValidYivenoUserId(userId: string | null | undefined): userId is string {
  return Boolean(userId && UUID_RE.test(userId.trim()))
}

/**
 * 是否为不可信的订阅 ID。
 * 拒绝空、过短、test- 前缀、非 Paddle `sub_` 形态。
 */
export function isFakeProviderSubscriptionId(id: string | null | undefined): boolean {
  if (!id) return true
  const trimmed = id.trim()
  if (trimmed.length < 8) return true
  if (/^test([_-]|$)/i.test(trimmed)) return true
  if (/^(fake|dummy|placeholder)/i.test(trimmed)) return true
  return !PADDLE_SUB_RE.test(trimmed)
}
