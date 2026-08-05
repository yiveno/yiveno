import { afterEach, describe, expect, mock, test } from 'bun:test'

import type { Env } from '../types/env'
import { extractEmbeddingsFromAiResponse, handleEmbed } from './ai-embed'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    }
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

  test('非 Pro → 403 pro_required', async () => {
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
    expect(response.status).toBe(403)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('pro_required')
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
})
