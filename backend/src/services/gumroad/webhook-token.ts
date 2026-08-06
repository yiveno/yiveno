/**
 * Gumroad Ping URL token 校验（与 seller_id 双因子）
 */

import { timingSafeEqual } from 'node:crypto'
import { errorJson } from '../../utils/response'
import { error as logErrorMessage } from '../../utils/logger'

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
 * 若配置了 GUMROAD_WEBHOOK_TOKEN，则要求 URL ?token= 或 Header x-yiveno-gumroad-token 匹配。
 * 未配置时仅打告警并放行（便于本地；生产须配置，见 ENVIRONMENT.md）。
 */
export function webhookVerifyToken(
  expectedToken: string | undefined,
  request: Request
): Response | null {
  const expected = (expectedToken || '').trim()
  if (!expected) {
    logErrorMessage('[Gumroad] 未配置 GUMROAD_WEBHOOK_TOKEN；生产必须配置')
    return null
  }

  const url = new URL(request.url)
  const fromQuery = (url.searchParams.get('token') || '').trim()
  const fromHeader = (request.headers.get('x-yiveno-gumroad-token') || '').trim()
  const provided = fromQuery || fromHeader

  if (!provided || !timingSafeEqualString(provided, expected)) {
    logErrorMessage('[Gumroad] webhook token 校验失败')
    return errorJson({ error: 'Invalid webhook token' }, 401)
  }

  return null
}
