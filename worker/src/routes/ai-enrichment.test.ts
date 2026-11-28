import { describe, expect, test, mock, afterEach } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'

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

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'

function createBaseEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    AI_HOSTED_MODEL: 'deepseek-flash',
    AI_HOSTED_MONTHLY_QUOTA: '999',
    AI_USAGE_KV: createKvMock() as unknown as Env['AI_USAGE_KV'],
    ...overrides
  } as unknown as Env
}

describe('POST /api/ai/enrichment/complete', () => {
  afterEach(() => {
    mock.restore()
  })

  test('缺少记忆字段 → 400', async () => {
    const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
    const response = await handleEnrichmentComplete(
      new Request('http://localhost/api/ai/enrichment/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      }),
      createBaseEnv(),
      TEST_USER_ID
    )
    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('missing_memory_fields')
  })

  test('代理成功并返回校验后的 proposal', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    objectType: 'video',
                    keywords: ['wwii', 'documentary'],
                    entities: ['Hitler'],
                    summary: 'BBC piece on Hitler legacy'
                  })
                },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 40 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: '希特勒死亡80年後 WWII documentary on Hitler',
            text: 'A BBC documentary about Hitler and the wwii legacy.',
            url: 'https://www.youtube.com/watch?v=x',
            domain: 'youtube.com',
            ruleHints: { tags: ['video'], keywords: ['video'] }
          })
        }),
        createBaseEnv(),
        TEST_USER_ID
      )

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        provider: string
        proposal: {
          objectType?: string
          keywords?: string[]
          entities?: string[]
          summary?: string
        }
      }
      expect(json.provider).toBe('enrichment')
      expect(json.proposal.objectType).toBe('video')
      expect(json.proposal.keywords?.includes('wwii')).toBe(true)
      expect(json.proposal.keywords?.includes('documentary')).toBe(true)
      expect(json.proposal.entities?.includes('Hitler')).toBe(true)
      expect(json.proposal.summary?.includes('Hitler')).toBe(true)
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('模型返回非法 JSON → 502 enrichment_parse_failed', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }],
            usage: { total_tokens: 3 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'x' })
        }),
        createBaseEnv(),
        TEST_USER_ID
      )
      expect(response.status).toBe(502)
      const payload = (await response.json()) as { error?: string }
      expect(payload.error).toBe('enrichment_parse_failed')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('无 Authorization → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/enrichment/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x' })
      },
      createBaseEnv()
    )
    expect(response.status).toBe(401)
  })

  test('用户日配额超限 → 429', async () => {
    const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
    const day = new Date().toISOString().slice(0, 10)
    const response = await handleEnrichmentComplete(
      new Request('http://localhost/api/ai/enrichment/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'quota' })
      }),
      createBaseEnv({
        AI_ENRICHMENT_DAILY_LIMIT: '1',
        AI_USAGE_KV: createKvMock({
          [`enrich_ai:user:${TEST_USER_ID}:${day}`]: '1'
        }) as unknown as Env['AI_USAGE_KV']
      }),
      TEST_USER_ID
    )
    expect(response.status).toBe(429)
    const payload = (await response.json()) as { error?: string; used?: number; limit?: number }
    expect(payload.error).toBe('quota_exceeded')
    expect(payload.limit).toBe(1)
  })

  test('IP 第二道配额超限 → 429（用户侧数字）', async () => {
    const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
    const day = new Date().toISOString().slice(0, 10)
    const response = await handleEnrichmentComplete(
      new Request('http://localhost/api/ai/enrichment/complete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.9'
        },
        body: JSON.stringify({ title: 'ip quota' })
      }),
      createBaseEnv({
        AI_ENRICHMENT_DAILY_LIMIT: '2',
        AI_USAGE_KV: createKvMock({
          [`enrich_ai:203.0.113.9:${day}`]: '2'
        }) as unknown as Env['AI_USAGE_KV']
      }),
      TEST_USER_ID
    )
    expect(response.status).toBe(429)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('quota_exceeded')
  })

  test('AI_HOSTED_MODEL_ENRICHMENT 覆盖传入 provider.complete', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    objectType: 'article',
                    keywords: ['test'],
                    entities: [],
                    summary: 'override model path'
                  })
                },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 10 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'override model' })
        }),
        createBaseEnv({ AI_HOSTED_MODEL_ENRICHMENT: 'deepseek-chat' }),
        TEST_USER_ID
      )
      expect(response.status).toBe(200)
      const firstFetchCall = fetchMock.mock.calls[0] as Parameters<typeof fetch> | undefined
      const requestBody = JSON.parse(String(firstFetchCall?.[1]?.body)) as { model?: string }
      expect(requestBody.model).toBe('deepseek-chat')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('未设分档 env 时 enrichment 走全局模型', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    objectType: 'article',
                    keywords: ['global'],
                    entities: [],
                    summary: 'global model path'
                  })
                },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 10 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'global model' })
        }),
        createBaseEnv(),
        TEST_USER_ID
      )
      expect(response.status).toBe(200)
      const firstFetchCall = fetchMock.mock.calls[0] as Parameters<typeof fetch> | undefined
      const requestBody = JSON.parse(String(firstFetchCall?.[1]?.body)) as { model?: string }
      expect(requestBody.model).toBe('deepseek-flash')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('parse 失败后用户与 IP used 均不变', async () => {
    const day = new Date().toISOString().slice(0, 10)
    const ip = '203.0.113.44'
    const userKey = `enrich_ai:user:${TEST_USER_ID}:${day}`
    const ipKey = `enrich_ai:${ip}:${day}`
    const kv = createKvMock({ [userKey]: '3', [ipKey]: '5' })
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }],
            usage: { total_tokens: 3 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cf-connecting-ip': ip
          },
          body: JSON.stringify({ title: 'parse fail billing' })
        }),
        createBaseEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] }),
        TEST_USER_ID
      )
      expect(response.status).toBe(502)
      expect(kv.store.get(userKey)).toBe('3')
      expect(kv.store.get(ipKey)).toBe('5')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('provider 失败后用户与 IP used 均不变', async () => {
    const day = new Date().toISOString().slice(0, 10)
    const ip = '203.0.113.45'
    const userKey = `enrich_ai:user:${TEST_USER_ID}:${day}`
    const ipKey = `enrich_ai:${ip}:${day}`
    const kv = createKvMock({ [userKey]: '6', [ipKey]: '8' })
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      throw new Error('provider down')
    }) as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cf-connecting-ip': ip
          },
          body: JSON.stringify({ title: 'provider fail billing' })
        }),
        createBaseEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] }),
        TEST_USER_ID
      )
      expect(response.status).toBe(500)
      expect(kv.store.get(userKey)).toBe('6')
      expect(kv.store.get(ipKey)).toBe('8')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('成功后用户与 IP used 各 +1', async () => {
    const day = new Date().toISOString().slice(0, 10)
    const ip = '203.0.113.46'
    const userKey = `enrich_ai:user:${TEST_USER_ID}:${day}`
    const ipKey = `enrich_ai:${ip}:${day}`
    const kv = createKvMock({ [userKey]: '1', [ipKey]: '2' })
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    objectType: 'article',
                    keywords: ['ok'],
                    entities: [],
                    summary: 'billing ok'
                  })
                },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 10 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleEnrichmentComplete } = await import('../handlers/ai-enrichment')
      const response = await handleEnrichmentComplete(
        new Request('http://localhost/api/ai/enrichment/complete', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cf-connecting-ip': ip
          },
          body: JSON.stringify({ title: 'billing ok' })
        }),
        createBaseEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] }),
        TEST_USER_ID
      )
      expect(response.status).toBe(200)
      const json = (await response.json()) as { quota: { used: number } }
      expect(json.quota.used).toBe(2)
      expect(kv.store.get(userKey)).toBe('2')
      expect(kv.store.get(ipKey)).toBe('3')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
