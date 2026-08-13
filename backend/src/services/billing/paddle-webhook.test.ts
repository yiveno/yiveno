import { describe, expect, test } from 'bun:test'

import { verifyPaddleWebhook } from './paddle-webhook'

const SECRET = 'pdl_ntfset_test_secret'
const USER_ID = '11111111-1111-4111-8111-111111111111'

function eventBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event_id: 'evt_01testeventid000000000001',
    event_type: 'subscription.created',
    occurred_at: '2026-08-14T00:00:00.000Z',
    data: {
      id: 'sub_01h1vjes1y163hjs1s211srxny',
      status: 'active',
      custom_data: { yiveno_user_id: USER_ID }
    },
    ...overrides
  })
}

async function sign(secret: string, rawBody: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`))
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `ts=${ts};h1=${hex}`
}

describe('verifyPaddleWebhook', () => {
  test('未配置 secret → not_configured', async () => {
    const result = await verifyPaddleWebhook('', 'ts=1;h1=abc', '{}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_configured')
  })

  test('签名不匹配 → invalid_signature', async () => {
    const body = eventBody()
    const ts = Math.floor(Date.now() / 1000)
    const result = await verifyPaddleWebhook(SECRET, `ts=${ts};h1=${'ab'.repeat(32)}`, body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_signature')
  })

  test('时间戳超出 300s → invalid_signature', async () => {
    const body = eventBody()
    const ts = Math.floor(Date.now() / 1000) - 400
    const header = await sign(SECRET, body, ts)
    const result = await verifyPaddleWebhook(SECRET, header, body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_signature')
  })

  test('有效签名 → 解析 event', async () => {
    const body = eventBody()
    const ts = Math.floor(Date.now() / 1000)
    const header = await sign(SECRET, body, ts)
    const result = await verifyPaddleWebhook(SECRET, header, body)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event.eventId).toBe('evt_01testeventid000000000001')
      expect(result.event.eventType).toBe('subscription.created')
    }
  })

  test('签名有效但缺 event_id → invalid_payload', async () => {
    const body = JSON.stringify({ event_type: 'subscription.created', data: { id: 'x' } })
    const ts = Math.floor(Date.now() / 1000)
    const header = await sign(SECRET, body, ts)
    const result = await verifyPaddleWebhook(SECRET, header, body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_payload')
  })
})
