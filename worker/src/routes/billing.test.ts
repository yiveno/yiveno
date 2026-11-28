import { describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    BILLING_FOUNDING_ENABLED: 'false',
    ...overrides
  } as unknown as Env
}

describe('POST /api/billing/checkout-session', () => {
  test('未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/billing/checkout-session',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'pro_monthly' })
      },
      env()
    )
    expect(response.status).toBe(401)
  })
})
