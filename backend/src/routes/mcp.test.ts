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

describe('只读 MCP 路由门禁', () => {
  test('GET /api/mcp/tools 缺少 Authorization → 401', async () => {
    const app = createApp()
    const response = await app.request('/api/mcp/tools', { method: 'GET' }, createBaseEnv())
    expect(response.status).toBe(401)
  })

  test('POST /api/mcp/tools/call 缺少 Authorization → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/mcp/tools/call',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'yiveno_recall_evidence',
          arguments: { clue: 'deploy' }
        })
      },
      createBaseEnv()
    )
    expect(response.status).toBe(401)
  })

  test('PUT /api/account/mcp 缺少 Authorization → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/account/mcp',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      },
      createBaseEnv()
    )
    expect(response.status).toBe(401)
  })
})
