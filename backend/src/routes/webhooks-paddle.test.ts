import { afterEach, describe, expect, jest, test } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'

const SECRET = 'pdl_ntfset_test_secret'

function env(): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    PADDLE_WEBHOOK_SECRET: SECRET
  } as Env
}

async function sign(rawBody: string, ts = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`))
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `ts=${ts};h1=${hex}`
}

describe('POST /api/webhooks/paddle', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('无效签名 → 401，不投影', async () => {
    const projection = await import('../services/billing/projection')
    const project = jest.spyOn(projection, 'projectPaddleWebhook')
    const app = createApp()
    const response = await app.request(
      '/api/webhooks/paddle',
      {
        method: 'POST',
        headers: { 'paddle-signature': 'ts=1;h1=deadbeef', 'content-type': 'application/json' },
        body: '{"event_id":"x"}'
      },
      env()
    )
    expect(response.status).toBe(401)
    expect(project).not.toHaveBeenCalled()
  })

  test('有效签名 → 200 + outcome', async () => {
    const projection = await import('../services/billing/projection')
    jest.spyOn(projection, 'projectPaddleWebhook').mockResolvedValue({ outcome: 'applied' })
    const body = JSON.stringify({
      event_id: 'evt_01route000000000000000001',
      event_type: 'subscription.updated',
      data: { id: 'sub_01h1vjes1y163hjs1s211srxny', status: 'active' }
    })
    const app = createApp()
    const response = await app.request(
      '/api/webhooks/paddle',
      {
        method: 'POST',
        headers: {
          'paddle-signature': await sign(body),
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
