import { describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'

function createBaseEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    ...overrides
  } as unknown as Env
}

describe('POST /api/account/delete', () => {
  test('缺少 Authorization → 401', async () => {
    const app = createApp()
    const response = await app.request('/api/account/delete', { method: 'POST' }, createBaseEnv())
    expect(response.status).toBe(401)
  })
})
