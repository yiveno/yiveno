import { describe, expect, test, mock, afterEach } from 'bun:test'

import { createApp } from '../app'
import type { Env } from '../types/env'
import { parseGsClueSamplesText } from '../services/ai/gs-clue-samples-proposal'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    }
  }
}

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'

function createBaseEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WEBSITE_URL: 'https://example.com',
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    AI_HOSTED_MODEL: 'deepseek-flash',
    AI_HOSTED_MONTHLY_QUOTA: '999',
    AI_USAGE_KV: createKvMock() as Env['AI_USAGE_KV'],
    ...overrides
  } as unknown as Env
}

const fourCluesJson = JSON.stringify({
  clues: [
    { text: 'That piece about why agents struggle to keep track of earlier turns in a chat' },
    { text: 'I remember reading something explaining why long-term memory for AI agents is hard' },
    { text: 'Something from work about giving assistants memory that lasts beyond one session' },
    { text: 'The surprising bit about agents forgetting context even when you feed them history' }
  ]
})

const sampleBookmark = {
  title: 'Why AI Agents Need Long-Term Memory',
  url: 'https://example.com/agents-memory'
}

describe('parseGsClueSamplesText', () => {
  test('解析恰好 4 条 clue', () => {
    const parsed = parseGsClueSamplesText(fourCluesJson, sampleBookmark)
    expect(parsed?.clues).toHaveLength(4)
    expect(parsed?.clues[0]?.text).toContain('agents')
  })

  test('条数不对 → null', () => {
    expect(
      parseGsClueSamplesText(
        JSON.stringify({ clues: [{ text: 'too short alone for schema' }] }),
        sampleBookmark
      )
    ).toBeNull()
  })
})

describe('POST /api/ai/gs-clue-samples/complete', () => {
  afterEach(() => {
    mock.restore()
  })

  test('缺 title → 400', async () => {
    const { handleGsClueSamplesComplete } = await import('../handlers/ai-gs-clue-samples')
    const response = await handleGsClueSamplesComplete(
      new Request('http://localhost/api/ai/gs-clue-samples/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookmark: { url: 'https://example.com' } })
      }),
      createBaseEnv(),
      TEST_USER_ID
    )
    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('invalid_body')
  })

  test('代理成功并返回 4 条 clue', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: fourCluesJson },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 80 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleGsClueSamplesComplete } = await import('../handlers/ai-gs-clue-samples')
      const response = await handleGsClueSamplesComplete(
        new Request('http://localhost/api/ai/gs-clue-samples/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            bookmark: {
              title: 'Why AI Agents Need Long-Term Memory',
              url: 'https://example.com/agents-memory'
            }
          })
        }),
        createBaseEnv(),
        TEST_USER_ID
      )

      expect(response.status).toBe(200)
      const json = (await response.json()) as {
        provider: string
        clues: Array<{ text: string }>
      }
      expect(json.provider).toBe('gs_clue_samples')
      expect(json.clues).toHaveLength(4)
      expect(json.clues[0]?.text.length).toBeGreaterThan(8)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('AI_HOSTED_MODEL_GS_SAMPLES 覆盖传入 provider.complete', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: fourCluesJson },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 80 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleGsClueSamplesComplete } = await import('../handlers/ai-gs-clue-samples')
      const response = await handleGsClueSamplesComplete(
        new Request('http://localhost/api/ai/gs-clue-samples/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            bookmark: {
              title: 'Why AI Agents Need Long-Term Memory',
              url: 'https://example.com/agents-memory'
            }
          })
        }),
        createBaseEnv({ AI_HOSTED_MODEL_GS_SAMPLES: 'deepseek-chat' }),
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

  test('未设分档 env 时 gs_samples 走全局模型', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: fourCluesJson },
                finish_reason: 'stop'
              }
            ],
            usage: { total_tokens: 80 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { handleGsClueSamplesComplete } = await import('../handlers/ai-gs-clue-samples')
      const response = await handleGsClueSamplesComplete(
        new Request('http://localhost/api/ai/gs-clue-samples/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            bookmark: {
              title: 'Why AI Agents Need Long-Term Memory',
              url: 'https://example.com/agents-memory'
            }
          })
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

  test('无 Authorization → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/gs-clue-samples/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bookmark: { title: 'Why AI Agents Need Long-Term Memory' }
        })
      },
      createBaseEnv()
    )
    expect(response.status).toBe(401)
  })

  test('用户日配额超限 → 429', async () => {
    const { handleGsClueSamplesComplete } = await import('../handlers/ai-gs-clue-samples')
    const day = new Date().toISOString().slice(0, 10)
    const response = await handleGsClueSamplesComplete(
      new Request('http://localhost/api/ai/gs-clue-samples/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bookmark: { title: 'Why AI Agents Need Long-Term Memory' }
        })
      }),
      createBaseEnv({
        AI_GS_CLUE_SAMPLES_DAILY_LIMIT: '1',
        AI_USAGE_KV: createKvMock({
          [`gs_clue_samples_ai:user:${TEST_USER_ID}:${day}`]: '1'
        }) as unknown as Env['AI_USAGE_KV']
      }),
      TEST_USER_ID
    )
    expect(response.status).toBe(429)
    const payload = (await response.json()) as { error?: string; limit?: number }
    expect(payload.error).toBe('quota_exceeded')
    expect(payload.limit).toBe(1)
  })

  test('IP 第二道配额超限 → 429', async () => {
    const { handleGsClueSamplesComplete } = await import('../handlers/ai-gs-clue-samples')
    const day = new Date().toISOString().slice(0, 10)
    const response = await handleGsClueSamplesComplete(
      new Request('http://localhost/api/ai/gs-clue-samples/complete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.9'
        },
        body: JSON.stringify({
          bookmark: { title: 'Why AI Agents Need Long-Term Memory' }
        })
      }),
      createBaseEnv({
        AI_GS_CLUE_SAMPLES_DAILY_LIMIT: '2',
        AI_USAGE_KV: createKvMock({
          [`gs_clue_samples_ai:203.0.113.9:${day}`]: '2'
        }) as unknown as Env['AI_USAGE_KV']
      }),
      TEST_USER_ID
    )
    expect(response.status).toBe(429)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('quota_exceeded')
  })
})
