/**
 * Dodo Payments webhook 验签与解析（Standard Webhooks）。
 * @see https://github.com/standard-webhooks/standard-webhooks
 */

import { error as logErrorMessage } from '../../utils/logger'

const MAX_SKEW_SECONDS = 300

export type DodoWebhookEvent = {
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return mismatch === 0
}

function webhookSecretBytes(secret: string): Uint8Array {
  const trimmed = secret.trim()
  if (trimmed.startsWith('whsec_')) {
    return base64ToBytes(trimmed.slice('whsec_'.length))
  }
  return new TextEncoder().encode(trimmed)
}

async function hmacSha256(secretBytes: Uint8Array, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return new Uint8Array(sig)
}

function parseSignatures(header: string): string[] {
  return header
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const comma = part.indexOf(',')
      if (comma <= 0) return ''
      const version = part.slice(0, comma)
      const value = part.slice(comma + 1)
      return version === 'v1' ? value : ''
    })
    .filter(Boolean)
}

/**
 * webhook 验签结果。
 * - not_configured：未配 DODO_PAYMENTS_WEBHOOK_KEY
 * - invalid_signature：签名或时间戳无效
 * - invalid_payload：JSON 缺 type / data
 */
export type VerifyDodoWebhookResult =
  | { ok: true; rawBody: string; event: DodoWebhookEvent }
  | {
      ok: false
      reason: 'not_configured' | 'invalid_signature' | 'invalid_payload' // 未配置 / 签名无效 / 载荷无效
    }

export type DodoWebhookHeaders = {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/**
 * 校验 Standard Webhooks 签名，并解析 JSON event。
 * 幂等键用 header `webhook-id`，不是 body 字段。
 */
export async function verifyDodoWebhook(
  secret: string | undefined,
  headers: DodoWebhookHeaders,
  rawBody: string
): Promise<VerifyDodoWebhookResult> {
  const expected = (secret || '').trim()
  if (!expected) {
    logErrorMessage('[Billing] 未配置 DODO_PAYMENTS_WEBHOOK_KEY，拒绝 webhook')
    return { ok: false, reason: 'not_configured' }
  }

  const msgId = (headers.id || '').trim()
  const msgTs = (headers.timestamp || '').trim()
  const msgSig = (headers.signature || '').trim()
  if (!msgId || !msgTs || !msgSig) {
    return { ok: false, reason: 'invalid_signature' }
  }

  const tsNum = Number(msgTs)
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > MAX_SKEW_SECONDS) {
    logErrorMessage('[Billing] webhook 时间戳超出窗口')
    return { ok: false, reason: 'invalid_signature' }
  }

  const computed = await hmacSha256(webhookSecretBytes(expected), `${msgId}.${msgTs}.${rawBody}`)
  const candidates = parseSignatures(msgSig)
  let matched = false
  for (const candidate of candidates) {
    try {
      if (timingSafeEqualBytes(base64ToBytes(candidate), computed)) {
        matched = true
        break
      }
    } catch {
      continue
    }
  }
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
  const eventType = typeof root?.type === 'string' ? root.type.trim() : ''
  const data = asRecord(root?.data)
  if (!eventType || !data) {
    return { ok: false, reason: 'invalid_payload' }
  }

  return {
    ok: true,
    rawBody,
    event: {
      eventId: msgId,
      eventType,
      occurredAt: typeof root?.timestamp === 'string' ? root.timestamp : null,
      data
    }
  }
}

/** 导出供单测构造签名（不用于生产路径）。 */
export async function signDodoWebhookForTest(
  secret: string,
  msgId: string,
  timestampUnix: number,
  rawBody: string
): Promise<string> {
  const computed = await hmacSha256(
    webhookSecretBytes(secret),
    `${msgId}.${timestampUnix}.${rawBody}`
  )
  return `v1,${bytesToBase64(computed)}`
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
