import { afterEach, describe, expect, mock, test } from 'bun:test'

import type { Env } from '../types/env'
import { AI_EXTRACT_FREE_DAILY_CAP } from '../services/ai/extract-quota'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    store
  }
}

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    AI_USAGE_KV: createKvMock() as Env['AI_USAGE_KV'],
    DEEPSEEK_API_KEY: 'test-key',
    ...overrides
  } as unknown as Env
}

const validBody = {
  url: 'https://example.com/a',
  title: 'Example',
  text: 'hello world '.repeat(40)
}

describe('handleExtractComplete', () => {
  afterEach(() => {
    mock.restore()
  })

  test('isAnonymous → 403 anonymous_not_allowed（不进 peek）', async () => {
    const { handleExtractComplete } = await import('./ai-extract')
    const res = await handleExtractComplete(
      new Request('http://localhost/api/ai/extract/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody)
      }),
      createEnv(),
      'extract-anon',
      true
    )
    expect(res.status).toBe(403)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('anonymous_not_allowed')
  })

  test('日盖满 → 429 deferred（peek 前拦，不调 provider）', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))

    const kv = createKvMock()
    const userId = '44444444-4444-4444-8444-444444444444'
    const day = new Date()
    const dayKey = `extract_ai:${userId}:d:${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
    await kv.put(dayKey, String(AI_EXTRACT_FREE_DAILY_CAP))

    const { handleExtractComplete } = await import('./ai-extract')
    const res = await handleExtractComplete(
      new Request('http://localhost/api/ai/extract/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody)
      }),
      createEnv({ AI_USAGE_KV: kv }),
      userId,
      false
    )
    expect(res.status).toBe(429)
    const data = (await res.json()) as { error: string; deferred?: boolean }
    expect(data.deferred).toBe(true)
    expect(data.error).toBe('daily_cap_exceeded')
  })

  test('解析失败 → 422 且不扣费（fetch mock，不污染 provider 模块）', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{' }, finish_reason: 'stop' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch

    try {
      const kv = createKvMock()
      const userId = '55555555-5555-4555-8555-555555555555'
      const { handleExtractComplete } = await import('./ai-extract')
      const res = await handleExtractComplete(
        new Request('http://localhost/api/ai/extract/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(validBody)
        }),
        createEnv({ AI_USAGE_KV: kv }),
        userId,
        false
      )
      expect(res.status).toBe(422)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBe('parse_failed')

      const month = new Date()
      const monthKey = `extract_ai:${userId}:m:${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
      expect(await kv.get(monthKey)).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
