import { describe, expect, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'

const testEnv = {
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com'
} as Env

describe('health routes', () => {
  test('GET /health returns worker health payload', async () => {
    const app = createApp()
    const response = await app.request('/health', {}, testEnv)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('x-request-id')).toBeTruthy()

    const data = (await response.json()) as {
      status: string
      runtime: string
      timestamp: string
    }

    expect(data.status).toBe('ok')
    expect(data.runtime).toBe('cloudflare-worker')
    expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false)
  })

  test('GET /api/health returns the same contract', async () => {
    const app = createApp()
    const response = await app.request('/api/health', {}, testEnv)

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      status: string
      runtime: string
    }

    expect(data.status).toBe('ok')
    expect(data.runtime).toBe('cloudflare-worker')
  })
})
