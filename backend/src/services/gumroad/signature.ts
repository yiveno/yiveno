/**
 * Gumroad Webhook 签名验证
 */

import { bufferToHex, timingSafeEqual } from '../../utils/gumroad-helpers'
import { errorJson } from '../../utils/response'

/** 验证 Gumroad Webhook HMAC-SHA256 签名 */
export async function verifySignature(
  secret: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  if (!secret) {
    console.warn('[Gumroad] 未配置 GUMROAD_WEBHOOK_SECRET，跳过验签')
    return true
  }
  if (!signature) {
    console.warn('[Gumroad] Webhook 缺少签名头')
    return false
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expectedHex = bufferToHex(signatureBuffer)
  return timingSafeEqual(expectedHex.toLowerCase(), signature.toLowerCase())
}

/** 验证 webhook 签名，不合法时返回 401 响应 */
export async function webhookVerifySignature(
  secret: string,
  rawBody: string,
  signature: string
): Promise<Response | null> {
  if (secret && signature) {
    const valid = await verifySignature(secret, rawBody, signature)
    if (!valid) {
      console.error('[Gumroad] Webhook 验签失败')
      return errorJson({ error: 'Invalid signature' }, 401)
    }
    return null
  }
  console.warn('[Gumroad] 未配置 Webhook Secret，跳过签名验证（仅用于开发测试）')
  return null
}
