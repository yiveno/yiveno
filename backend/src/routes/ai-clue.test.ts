import { describe, expect, test, mock, afterEach } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    }
  }
}

function createBaseEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    AI_HOSTED_MODEL: 'deepseek-v4-flash',
    AI_HOSTED_MONTHLY_QUOTA: '999',
    AI_USAGE_KV: createKvMock() as Env['AI_USAGE_KV'],
    AI: {
      run: async () => ({ answer: 'ok' })
    },
    ...overrides
  } as unknown as Env
}

describe('POST /api/ai/clue/complete', () => {
  afterEach(() => {
    mock.restore()
  })

  test('缺少 DEEPSEEK_API_KEY → 503', async () => {
    const { handleClueComplete } = await import('../handlers/ai-clue')
    const response = await handleClueComplete(
      new Request('http://localhost/api/ai/clue/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' })
      }),
      createBaseEnv({ DEEPSEEK_API_KEY: '' })
    )
    expect(response.status).toBe(503)
  })

  test('代理 DeepSeek messages 成功', async () => {
    mock.module('../services/ai/deepseek-client', () => ({
      completeWithDeepSeek: async () => ({
        text: '{"contentTerms":["movie"],"confidence":"medium"}',
        model: 'deepseek-v4-flash',
        tokensUsed: 12
      })
    }))

    const { handleClueComplete } = await import('../handlers/ai-clue')
    const response = await handleClueComplete(
      new Request('http://localhost/api/ai/clue/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'return json' },
            { role: 'user', content: 'The movie I watched yesterday' }
          ],
          maxTokens: 400,
          temperature: 0
        })
      }),
      createBaseEnv()
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { text: string; provider: string }
    expect(json.provider).toBe('clue')
    expect(json.text).toContain('movie')
  })

  test('路由已挂载', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/clue/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      },
      createBaseEnv({ DEEPSEEK_API_KEY: '' })
    )
    // 无 key → 503；证明路由可达
    expect(response.status).toBe(503)
  })
})
