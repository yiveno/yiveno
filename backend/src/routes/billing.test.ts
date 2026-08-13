import { describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    BILLING_FOUNDING_ENABLED: 'false',
    ...overrides
  } as unknown as Env
}

describe('GET /api/billing/plans', () => {
  test('公开目录不含 Price ID，默认无 Founding', async () => {
    const app = createApp()
    const response = await app.request('/api/billing/plans', {}, env())
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      success: boolean
      data: { plans: Array<{ id: string; displayUsd: string }> }
    }
    expect(json.success).toBe(true)
    expect(json.data.plans.map(plan => plan.id)).toEqual(['pro_monthly', 'pro_annual'])
    expect(JSON.stringify(json)).not.toContain('pri_')
    expect(json.data.plans[0]?.displayUsd).toBe('7.99')
    expect(json.data.plans[1]?.displayUsd).toBe('59.99')
  })
})

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
