/**
 * Gumroad Ping 请求校验
 */

import { timingSafeEqual } from 'node:crypto'
import { errorJson } from '../../utils/response'
import { error as logErrorMessage } from '../../utils/logger'
import type { GumroadWebhookPayload } from './webhook-parser'

/**
 * 常量时间比较两个字符串（长度不同则直接 false）。
 * 避免 seller_id 明文 `!==` 的计时侧信道。
 */
function timingSafeEqualString(left: string, right: string): boolean {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.byteLength !== b.byteLength) {
    return false
  }
  return timingSafeEqual(a, b)
}

/**
 * 验证 Gumroad Ping seller_id。
 * 未配置期望 seller_id 时拒绝请求（禁止跳过校验）。
 */
export async function webhookVerifySeller(
  expectedSellerId: string,
  payload: GumroadWebhookPayload
): Promise<Response | null> {
  if (!expectedSellerId.trim()) {
    logErrorMessage('[Gumroad] 未配置 GUMROAD_SELLER_ID，拒绝 webhook')
    return errorJson({ error: 'seller_id_not_configured' }, 503)
  }

  const sellerId = payload.seller_id || ''
  if (!timingSafeEqualString(sellerId, expectedSellerId)) {
    logErrorMessage('[Gumroad] seller_id 校验失败', {
      hasSellerId: Boolean(sellerId)
    })
    return errorJson({ error: 'Invalid seller_id' }, 401)
  }

  return null
}
