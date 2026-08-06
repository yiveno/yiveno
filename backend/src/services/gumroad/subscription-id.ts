/**
 * Gumroad 订阅 ID / 订单证据校验（§A.3.2 授 Pro 硬门槛）
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 是否为可接受的 Yiveno user_id（Supabase Auth UUID） */
export function isValidYivenoUserId(userId: string | null | undefined): boolean {
  return Boolean(userId && UUID_RE.test(userId.trim()))
}

/**
 * 是否为明显假/测试订阅 ID。
 * 拒绝 test- 前缀、过短、纯数字占位等，避免手工行授 Pro。
 */
export function isFakeGumroadSubscriptionId(id: string | null | undefined): boolean {
  if (!id) return true
  const trimmed = id.trim()
  if (trimmed.length < 8) return true
  if (/^test([_-]|$)/i.test(trimmed)) return true
  if (/^(fake|dummy|placeholder)/i.test(trimmed)) return true
  return false
}

/** 激活 active 所需的订单证据（order_id 或 sale_id） */
export function hasOrderEvidence(
  orderId: string | null | undefined,
  saleId: string | null | undefined
): boolean {
  const order = (orderId || '').trim()
  const sale = (saleId || '').trim()
  return Boolean(order || sale)
}
