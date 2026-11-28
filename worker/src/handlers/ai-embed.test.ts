import { afterEach, describe, expect, mock, test } from 'bun:test'

import type { Env } from '../types/env'
import { extractEmbeddingsFromAiResponse } from './ai-embed'

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

function utcDay(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    AI_USAGE_KV: createKvMock() as unknown as Env['AI_USAGE_KV'],
    AI: {
      run: async () => ({
        data: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6]
        ],
        shape: [2, 3]
      })
    },
    ...overrides
  } as unknown as Env
}

describe('extractEmbeddingsFromAiResponse', () => {
  test('解析 bge-m3 data: number[][]', () => {
    const vectors = extractEmbeddingsFromAiResponse(
      {
        data: [
          [1, 2],
          [3, 4]
        ],
        shape: [2, 2]
      },
      2
    )
    expect(vectors).toEqual([
      [1, 2],
      [3, 4]
    ])
  })

  test('条数不足 → 抛错', () => {
    expect(() => extractEmbeddingsFromAiResponse({ data: [[1]] }, 2)).toThrow(
      'invalid_ai_embedding_response'
    )
  })
})

describe('handleEmbed', () => {
  afterEach(() => {
    mock.restore()
  })

  test('登录 Free → 200 embeddings（日配额分档）', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv(),
      'user-1'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      success: boolean
      data: { embeddings: number[][] }
    }
    expect(json.success).toBe(true)
    expect(json.data.embeddings).toHaveLength(1)
  })

  test('Pro + AI → 200 embeddings', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => true
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['a', 'b'] })
      }),
      createEnv(),
      'user-pro'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      success: boolean
      data: { model: string; dim: number; embeddings: number[][] }
    }
    expect(json.success).toBe(true)
    expect(json.data.dim).toBe(3)
    expect(json.data.embeddings).toHaveLength(2)
  })

  test('缺少 AI binding → 503', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => true
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['a'] })
      }),
      createEnv({ AI: undefined }),
      'user-pro'
    )
    expect(response.status).toBe(503)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('ai_binding_missing')
  })

  test('kv.get 抛错 → fail-open 200 + quota.degraded', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const kv = {
      get: async () => {
        throw new Error('kv_get_rate_limited')
      },
      put: async () => {
        throw new Error('should_not_put')
      }
    }
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({ AI_USAGE_KV: kv }),
      'user-kv-get-fail'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      success: boolean
      data: {
        embeddings: number[][]
        quota: { used: number; limit: number; remaining: number; degraded?: boolean }
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.embeddings).toHaveLength(1)
    expect(json.data.quota.degraded).toBe(true)
    expect(json.data.quota.used).toBe(0)
    expect(json.data.quota.limit).toBe(100)
    expect(json.data.quota.remaining).toBe(100)
  })

  test('kv.put 抛错 → fail-open 200 + quota.degraded', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const kv = {
      get: async () => null,
      put: async () => {
        throw new Error('kv_put_rate_limited')
      }
    }
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({ AI_USAGE_KV: kv }),
      'user-kv-put-fail'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      success: boolean
      data: {
        embeddings: number[][]
        quota: { used: number; limit: number; remaining: number; degraded?: boolean }
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.embeddings).toHaveLength(1)
    expect(json.data.quota.degraded).toBe(true)
    expect(json.data.quota.used).toBe(0)
    expect(json.data.quota.limit).toBe(100)
  })

  test('AI.run 抛错 → 502 embed_failed + cause ai_run_failed', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI: {
          run: async () => {
            throw new Error('upstream boom')
          }
        }
      }),
      'user-ai-run-fail'
    )
    expect(response.status).toBe(502)
    const jsonRun = (await response.json()) as { error: string; cause: string }
    expect(jsonRun.error).toBe('embed_failed')
    expect(jsonRun.cause).toBe('ai_run_failed')
  })

  test('AI 响应异常 → 502 embed_failed + cause invalid_ai_response', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI: {
          run: async () => ({ data: 'not-array' })
        }
      }),
      'user-ai-shape-fail'
    )
    expect(response.status).toBe(502)
    const jsonShape = (await response.json()) as { error: string; cause: string }
    expect(jsonShape.error).toBe('embed_failed')
    expect(jsonShape.cause).toBe('invalid_ai_response')
  })

  test('空向量 → 502 embed_failed + cause empty_embedding', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI: {
          run: async () => ({ data: [[]] })
        }
      }),
      'user-empty-embed'
    )
    expect(response.status).toBe(502)
    const jsonEmpty = (await response.json()) as { error: string; cause: string }
    expect(jsonEmpty.error).toBe('embed_failed')
    expect(jsonEmpty.cause).toBe('empty_embedding')
  })

  test('豁免账号日配额已满仍 200，计数 +1，limit=MAX_SAFE_INTEGER', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const now = new Date()
    const day = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    const userId = 'exempt-embed-user'
    const store = new Map<string, string>([[`embed_ai:${userId}:${day}`, '100']])
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value)
      }
    }
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI_USAGE_KV: kv,
        AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-embed-user'
      }),
      userId
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      success: boolean
      data: { quota: { used: number; limit: number; remaining: number } }
    }
    expect(json.success).toBe(true)
    expect(json.data.quota.used).toBe(101)
    expect(json.data.quota.limit).toBe(Number.MAX_SAFE_INTEGER)
    expect(store.get(`embed_ai:${userId}:${day}`)).toBe('101')
  })

  test('非豁免账号日配额已满 → 429 quota_exceeded', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const day = utcDay()
    const userId = 'normal-embed-user'
    const kv = createKvMock({ [`embed_ai:${userId}:${day}`]: '100' })
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
        AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-embed-user'
      }),
      userId
    )
    expect(response.status).toBe(429)
    const json = (await response.json()) as { error: string; used: number; limit: number }
    expect(json.error).toBe('quota_exceeded')
    expect(json.used).toBe(100)
    expect(json.limit).toBe(100)
  })
})

describe('handleEmbed 成功计费', () => {
  afterEach(() => {
    mock.restore()
  })

  test('invalid_json 后 used 不变', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const userId = 'embed-billing-json'
    const day = utcDay()
    const key = `embed_ai:${userId}:${day}`
    const kv = createKvMock({ [key]: '3' })
    let aiCalls = 0
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not-json'
      }),
      createEnv({
        AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
        AI: {
          run: async () => {
            aiCalls += 1
            return { data: [[0.1]] }
          }
        }
      }),
      userId
    )
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('invalid_json')
    expect(kv.store.get(key)).toBe('3')
    expect(aiCalls).toBe(0)
  })

  test('invalid_texts 后 used 不变', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const userId = 'embed-billing-texts'
    const day = utcDay()
    const key = `embed_ai:${userId}:${day}`
    const kv = createKvMock({ [key]: '4' })
    let aiCalls = 0
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: [] })
      }),
      createEnv({
        AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
        AI: {
          run: async () => {
            aiCalls += 1
            return { data: [[0.1]] }
          }
        }
      }),
      userId
    )
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('invalid_texts')
    expect(kv.store.get(key)).toBe('4')
    expect(aiCalls).toBe(0)
  })

  test('AI 失败后 used 不变', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const userId = 'embed-billing-ai-fail'
    const day = utcDay()
    const key = `embed_ai:${userId}:${day}`
    const kv = createKvMock({ [key]: '5' })
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
        AI: {
          run: async () => {
            throw new Error('upstream boom')
          }
        }
      }),
      userId
    )
    expect(response.status).toBe(502)
    expect(kv.store.get(key)).toBe('5')
  })

  test('成功后 used +1', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const userId = 'embed-billing-ok'
    const day = utcDay()
    const key = `embed_ai:${userId}:${day}`
    const kv = createKvMock({ [key]: '7' })
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] }),
      userId
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      data: { quota: { used: number } }
    }
    expect(json.data.quota.used).toBe(8)
    expect(kv.store.get(key)).toBe('8')
  })

  test('配额不足仍 429 且不调用 AI', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleEmbed: handle } = await import('./ai-embed')
    const userId = 'embed-billing-deny'
    const day = utcDay()
    const key = `embed_ai:${userId}:${day}`
    const kv = createKvMock({ [key]: '100' })
    let aiCalls = 0
    const response = await handle(
      new Request('http://localhost/api/ai/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] })
      }),
      createEnv({
        AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
        AI: {
          run: async () => {
            aiCalls += 1
            return { data: [[0.1, 0.2]] }
          }
        }
      }),
      userId
    )
    expect(response.status).toBe(429)
    expect(kv.store.get(key)).toBe('100')
    expect(aiCalls).toBe(0)
  })
})
