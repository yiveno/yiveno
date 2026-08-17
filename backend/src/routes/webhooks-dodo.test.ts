import { afterEach, describe, expect, jest, test } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'
import { signDodoWebhookForTest } from '../services/billing/dodo-webhook'

const SECRET = 'whsec_dGVzdF9kb2RvX3dlYmhvb2tfc2VjcmV0'
const EVENT_ID = 'evt_01route000000000000000001'

function env(): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    DODO_PAYMENTS_WEBHOOK_KEY: SECRET
  } as Env
}

describe('POST /api/webhooks/dodo', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('无效签名 → 401，不投影', async () => {
    const projection = await import('../services/billing/projection')
    const project = jest.spyOn(projection, 'projectDodoWebhook')
    const app = createApp()
    const response = await app.request(
      '/api/webhooks/dodo',
      {
        method: 'POST',
        headers: {
          'webhook-id': EVENT_ID,
          'webhook-timestamp': '1',
          'webhook-signature': 'v1,deadbeef',
          'content-type': 'application/json'
        },
        body: '{"type":"subscription.active"}'
      },
      env()
    )
    expect(response.status).toBe(401)
    expect(project).not.toHaveBeenCalled()
  })

  test('有效签名 → 200 + outcome', async () => {
    const projection = await import('../services/billing/projection')
    jest.spyOn(projection, 'projectDodoWebhook').mockResolvedValue({ outcome: 'applied' })
    const body = JSON.stringify({
      type: 'subscription.active',
      data: { subscription_id: 'sub_Iuaq622bbmmfOGrVTqdXv', status: 'active' }
    })
    const ts = Math.floor(Date.now() / 1000)
    const signature = await signDodoWebhookForTest(SECRET, EVENT_ID, ts, body)
    const app = createApp()
    const response = await app.request(
      '/api/webhooks/dodo',
      {
        method: 'POST',
        headers: {
          'webhook-id': EVENT_ID,
          'webhook-timestamp': String(ts),
          'webhook-signature': signature,
          'content-type': 'application/json'
        },
        body
      },
      env()
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; outcome: string }
    expect(json.success).toBe(true)
    expect(json.outcome).toBe('applied')
  })
})
