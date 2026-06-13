import { describe, expect, test, mock } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'

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

async function importHostedHandlersAsPro() {
  mock.module('../services/ai/require-pro-user', () => ({
    isActiveProUser: async () => true
  }))
  return import('../handlers/ai-hosted')
}

describe('hosted ai routes', () => {
  test('GET /api/ai/hosted/quota rejects missing authorization', async () => {
    const app = createApp()
    const response = await app.request('/api/ai/hosted/quota', {}, createBaseEnv())

    expect(response.status).toBe(401)
  })

  test('handleHostedComplete rejects missing prompt', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()

    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      }),
      createBaseEnv(),
      TEST_USER_ID
    )

    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('missing_prompt')
  })

  test('handleHostedComplete returns quota_exceeded when limit reached', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const monthKey = `ai_usage:${TEST_USER_ID}:2026-06`

    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: '整理书签' })
      }),
      createBaseEnv({
        AI_HOSTED_MONTHLY_QUOTA: '1',
        AI_USAGE_KV: createKvMock({ [monthKey]: '1' }) as unknown as Env['AI_USAGE_KV']
      }),
      TEST_USER_ID
    )

    expect(response.status).toBe(429)
    const data = (await response.json()) as { error: string; limit: number }
    expect(data.error).toBe('quota_exceeded')
    expect(data.limit).toBe(1)
  })

  test('handleHostedComplete proxies DeepSeek and increments quota', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const monthKey = `ai_usage:${TEST_USER_ID}:2026-06`
    const kv = createKvMock()

    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"folders":[]}' } }],
            usage: { total_tokens: 42 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const response = await handleHostedComplete(
        new Request('http://localhost/api/ai/hosted/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: '整理书签', maxTokens: 128 })
        }),
        createBaseEnv({
          AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV']
        }),
        TEST_USER_ID
      )

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        text: string
        provider: string
        model: string
        quota: { used: number; limit: number }
      }
      expect(data.text).toBe('{"folders":[]}')
      expect(data.provider).toBe('hosted')
      expect(data.model).toBe('deepseek-v4-flash')
      expect(data.quota.used).toBe(1)
      expect(await kv.get(monthKey)).toBe('1')
      expect(fetchMock).toHaveBeenCalled()
      const fetchInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
      const requestBody = JSON.parse(String(fetchInit?.body)) as {
        thinking?: { type?: string }
      }
      expect(requestBody.thinking).toEqual({ type: 'disabled' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('handleHostedQuota returns quota for pro user', async () => {
    const { handleHostedQuota } = await importHostedHandlersAsPro()

    const response = await handleHostedQuota(
      new Request('http://localhost/api/ai/hosted/quota'),
      createBaseEnv(),
      TEST_USER_ID
    )

    expect(response.status).toBe(200)
    const data = (await response.json()) as { model: string; limit: number }
    expect(data.model).toBe('deepseek-v4-flash')
    expect(data.limit).toBe(999)
  })
})
