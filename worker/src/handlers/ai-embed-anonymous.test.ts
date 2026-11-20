import { afterEach, describe, expect, mock, test } from 'bun:test'

import type { Env } from '../types/env'
import { buildAnonymousEmbedUsageKey } from './ai-embed'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    }
  }
}

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    AI_USAGE_KV: createKvMock() as unknown as Env['AI_USAGE_KV'],
    AI: {
      run: async () => ({ data: [[0.1, 0.2]], shape: [1, 2] })
    },
    AI_EMBED_ANONYMOUS_LIFETIME_LIMIT: '30',
    ...overrides
  } as unknown as Env
}

afterEach(() => {
  mock.restore()
})

describe('handleEmbed 匿名终身', () => {
  test('第 30 次放行、第 31 次 429 tier=anonymous', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => true
    }))
    const { handleEmbed } = await import('./ai-embed')
    const userId = 'embed-anon-1'
    const kv = createKvMock({ [buildAnonymousEmbedUsageKey(userId)]: '29' })
    const env = createEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] })

    const ok = await handleEmbed(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['a'] })
      }),
      env,
      userId,
      true
    )
    expect(ok.status).toBe(200)

    const denied = await handleEmbed(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['b'] })
      }),
      env,
      userId,
      true
    )
    expect(denied.status).toBe(429)
    const data = (await denied.json()) as { error: string; tier: string; limit: number }
    expect(data.error).toBe('quota_exceeded')
    expect(data.tier).toBe('anonymous')
    expect(data.limit).toBe(30)
  })

  test('KV get 故障 fail-open + degraded', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed } = await import('./ai-embed')
    const kv = {
      get: async () => {
        throw new Error('kv_get_rate_limited')
      },
      put: async () => undefined
    }
    const res = await handleEmbed(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['x'] })
      }),
      createEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] }),
      'embed-anon-2',
      true
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { quota: { degraded?: boolean } } }
    expect(json.data.quota.degraded).toBe(true)
  })
})
