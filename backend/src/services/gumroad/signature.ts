/**
 * Gumroad Ping 请求校验
 */

import { errorJson } from '../../utils/response'
import { warn, error as logErrorMessage } from '../../utils/logger'
import type { GumroadWebhookPayload } from './webhook-parser'

/** 验证 Gumroad Ping seller_id，不合法时返回 401 响应 */
export async function webhookVerifySeller(
  expectedSellerId: string,
  payload: GumroadWebhookPayload
): Promise<Response | null> {
  if (!expectedSellerId) {
    warn('[Gumroad] 未配置 GUMROAD_SELLER_ID，跳过 seller_id 校验')
    return null
  }

  const sellerId = payload.seller_id || ''
  if (sellerId !== expectedSellerId) {
    logErrorMessage('[Gumroad] seller_id 校验失败', {
      hasSellerId: Boolean(sellerId)
    })
    return errorJson({ error: 'Invalid seller_id' }, 401)
  }

  return null
}
