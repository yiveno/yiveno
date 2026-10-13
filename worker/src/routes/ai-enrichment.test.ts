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
      createBaseEnv()
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
            title: '希特勒死亡80年後',
            url: 'https://www.youtube.com/watch?v=x',
            domain: 'youtube.com',
            ruleHints: { tags: ['video'], keywords: ['video'] }
          })
        }),
        createBaseEnv()
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
        createBaseEnv()
      )
      expect(response.status).toBe(502)
      const payload = (await response.json()) as { error?: string }
      expect(payload.error).toBe('enrichment_parse_failed')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('路由已挂载', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/enrichment/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      },
      createBaseEnv({ DEEPSEEK_API_KEY: '' })
    )
    expect([400, 503]).toContain(response.status)
  })
})
