import { describe, expect, test } from 'bun:test'

import { signDodoWebhookForTest, verifyDodoWebhook } from './dodo-webhook'

const SECRET = 'whsec_dGVzdF9kb2RvX3dlYmhvb2tfc2VjcmV0'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const EVENT_ID = 'evt_01testeventid000000000001'

function eventBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'subscription.active',
    timestamp: '2026-08-14T00:00:00.000Z',
    data: {
      subscription_id: 'sub_Iuaq622bbmmfOGrVTqdXv',
      status: 'active',
      metadata: { yiveno_user_id: USER_ID }
    },
    ...overrides
  })
}

describe('verifyDodoWebhook', () => {
  test('未配置 secret → not_configured', async () => {
    const result = await verifyDodoWebhook(
      '',
      { id: EVENT_ID, timestamp: '1', signature: 'v1,abc' },
      '{}'
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_configured')
  })

  test('签名不匹配 → invalid_signature', async () => {
    const body = eventBody()
    const ts = Math.floor(Date.now() / 1000)
    const result = await verifyDodoWebhook(
      SECRET,
      { id: EVENT_ID, timestamp: String(ts), signature: `v1,${'ab'.repeat(22)}` },
      body
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_signature')
  })

  test('时间戳超出 300s → invalid_signature', async () => {
    const body = eventBody()
    const ts = Math.floor(Date.now() / 1000) - 400
    const header = await signDodoWebhookForTest(SECRET, EVENT_ID, ts, body)
    const result = await verifyDodoWebhook(
      SECRET,
      { id: EVENT_ID, timestamp: String(ts), signature: header },
      body
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_signature')
  })

  test('有效签名 → 解析 event', async () => {
    const body = eventBody()
    const ts = Math.floor(Date.now() / 1000)
    const header = await signDodoWebhookForTest(SECRET, EVENT_ID, ts, body)
    const result = await verifyDodoWebhook(
      SECRET,
      { id: EVENT_ID, timestamp: String(ts), signature: header },
      body
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event.eventId).toBe(EVENT_ID)
      expect(result.event.eventType).toBe('subscription.active')
    }
  })

  test('签名有效但缺 type → invalid_payload', async () => {
    const body = JSON.stringify({ data: { subscription_id: 'x' } })
    const ts = Math.floor(Date.now() / 1000)
    const header = await signDodoWebhookForTest(SECRET, EVENT_ID, ts, body)
    const result = await verifyDodoWebhook(
      SECRET,
      { id: EVENT_ID, timestamp: String(ts), signature: header },
      body
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_payload')
  })
})
