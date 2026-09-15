import { describe, expect, test, mock, afterEach } from 'bun:test'

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

const fourCluesJson = JSON.stringify({
  clues: [
    { text: 'That piece about why agents struggle to keep track of earlier turns in a chat' },
    { text: 'I remember reading something explaining why long-term memory for AI agents is hard' },
    { text: 'Something from work about giving assistants memory that lasts beyond one session' },
    { text: 'The surprising bit about agents forgetting context even when you feed them history' }
  ]
})

describe('parseGsClueSamplesText', () => {
  test('解析恰好 4 条 clue', () => {
    const parsed = parseGsClueSamplesText(fourCluesJson)
    expect(parsed?.clues).toHaveLength(4)
    expect(parsed?.clues[0]?.text).toContain('agents')
  })

  test('条数不对 → null', () => {
    expect(
      parseGsClueSamplesText(JSON.stringify({ clues: [{ text: 'too short alone for schema' }] }))
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
      createBaseEnv()
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
        createBaseEnv()
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
})
