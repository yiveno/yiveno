/**
 * Paddle Billing webhook 验签与解析。
 * @see https://developer.paddle.com/webhooks/about/signature-verification
 */

import { error as logErrorMessage } from '../../utils/logger'

const MAX_SKEW_SECONDS = 300

export type PaddleWebhookEvent = {
  eventId: string
  eventType: string
  occurredAt: string | null
  data: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseSignatureHeader(header: string): { ts: string; h1: string[] } | null {
  const parts = header.split(';').map(part => part.trim())
  let ts = ''
  const h1: string[] = []
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq)
    const value = part.slice(eq + 1)
    if (key === 'ts') ts = value
    if (key === 'h1' && value) h1.push(value)
  }
  if (!ts || h1.length === 0) return null
  return { ts, h1 }
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * webhook 验签结果。
 * - not_configured：未配 PADDLE_WEBHOOK_SECRET
 * - invalid_signature：签名或时间戳无效
 * - invalid_payload：JSON 缺 event_id / event_type / data
 */
export type VerifyPaddleWebhookResult =
  | { ok: true; rawBody: string; event: PaddleWebhookEvent }
  | {
      ok: false
      reason: 'not_configured' | 'invalid_signature' | 'invalid_payload' // 未配置 / 签名无效 / 载荷无效
    }

/**
 * 校验 Paddle-Signature，并解析 JSON event。
 * 无效签名不得写库。
 */
export async function verifyPaddleWebhook(
  secret: string | undefined,
  signatureHeader: string | null,
  rawBody: string
): Promise<VerifyPaddleWebhookResult> {
  const expected = (secret || '').trim()
  if (!expected) {
    logErrorMessage('[Billing] 未配置 PADDLE_WEBHOOK_SECRET，拒绝 webhook')
    return { ok: false, reason: 'not_configured' }
  }

  const parsed = parseSignatureHeader(signatureHeader || '')
  if (!parsed) {
    return { ok: false, reason: 'invalid_signature' }
  }

  const tsNum = Number(parsed.ts)
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > MAX_SKEW_SECONDS) {
    logErrorMessage('[Billing] webhook 时间戳超出窗口')
    return { ok: false, reason: 'invalid_signature' }
  }

  const computed = await hmacSha256Hex(expected, `${parsed.ts}:${rawBody}`)
  const matched = parsed.h1.some(candidate => timingSafeEqualHex(candidate, computed))
  if (!matched) {
    logErrorMessage('[Billing] webhook 签名不匹配')
    return { ok: false, reason: 'invalid_signature' }
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return { ok: false, reason: 'invalid_payload' }
  }

  const root = asRecord(json)
  const eventId = typeof root?.event_id === 'string' ? root.event_id.trim() : ''
  const eventType = typeof root?.event_type === 'string' ? root.event_type.trim() : ''
  const data = asRecord(root?.data)
  if (!eventId || !eventType || !data) {
    return { ok: false, reason: 'invalid_payload' }
  }

  return {
    ok: true,
    rawBody,
    event: {
      eventId,
      eventType,
      occurredAt: typeof root?.occurred_at === 'string' ? root.occurred_at : null,
      data
    }
  }
}

/** 轻量指纹（不存全文） */
export function hashWebhookPayload(rawBody: string): string {
  let h = 2166136261
  for (let i = 0; i < rawBody.length; i++) {
    h ^= rawBody.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `fnv1a_${(h >>> 0).toString(16)}`
}
