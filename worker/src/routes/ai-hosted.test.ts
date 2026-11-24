import { describe, expect, test, mock } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import {
  HOSTED_SYSTEM_PROMPT_PREFIXES,
  validateHostedSystemPrompt
} from '../services/ai/hosted-system-prompts'

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
    AI_USAGE_KV: createKvMock() as Env['AI_USAGE_KV'],
    ...overrides
  } as unknown as Env
}

async function importHostedHandlersAsPro() {
  mock.module('../services/ai/require-pro-user', () => ({
    isActiveProUser: async () => true
  }))
  return import('../handlers/ai-hosted')
}

/** 构造可通过指纹校验的最小合法 [system, user]（锚行来自 hosted-system-prompts）。 */
function validMessages(
  kind: 'nlu' | 'framing_nlg' | 'follow_up_nlg' | 'narrow_polish',
  userContent = 'find that note'
): Array<{ role: 'system' | 'user'; content: string }> {
  let system: string
  switch (kind) {
    case 'nlu':
      system = [
        HOSTED_SYSTEM_PROMPT_PREFIXES.nluParse,
        'Output ONLY one JSON object. No markdown, no commentary.',
        '- Do not invent memory ids or database operations. JSON proposal only.'
      ].join('\n')
      break
    case 'framing_nlg':
      system = [
        HOSTED_SYSTEM_PROMPT_PREFIXES.framing_nlg,
        'Return ONLY JSON:',
        '- empty array for top_pick. label matches reply language; value MUST be stable English phrases.'
      ].join('\n')
      break
    case 'follow_up_nlg':
      system = [
        HOSTED_SYSTEM_PROMPT_PREFIXES.follow_up_nlg,
        'Return ONLY a JSON object:',
        '- Never invent memory items, titles, URLs, or facts not in weakCandidateTitles / context.'
      ].join('\n')
      break
    case 'narrow_polish':
      system = [
        HOSTED_SYSTEM_PROMPT_PREFIXES.narrow_polish,
        'Return ONLY a JSON object:',
        '- Forbidden: inventing new words, synonyms, themes, extra tokens, or swapping to a different selected word.'
      ].join('\n')
      break
  }
  expect(validateHostedSystemPrompt(kind, system)).toBe(true)
  return [
    { role: 'system', content: system },
    { role: 'user', content: userContent }
  ]
}

describe('hosted ai routes', () => {
  test('GET /api/ai/hosted/quota rejects missing authorization', async () => {
    const app = createApp()
    const response = await app.request('/api/ai/hosted/quota', {}, createBaseEnv())

    expect(response.status).toBe(401)
  })

  test('handleHostedComplete rejects bare prompt → missing_messages', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()

    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: '整理书签' })
      }),
      createBaseEnv(),
      TEST_USER_ID
    )

    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('missing_messages')
  })

  test('handleHostedComplete rejects empty body → missing_messages', async () => {
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
    expect(data.error).toBe('missing_messages')
  })

  test('handleHostedComplete rejects assistant role → invalid_messages', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: HOSTED_SYSTEM_PROMPT_PREFIXES.nluParse },
            { role: 'assistant', content: 'hi' }
          ]
        })
      }),
      createBaseEnv(),
      TEST_USER_ID
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_messages')
  })

  test('handleHostedComplete rejects unknown system → invalid_system_prompt', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'you are a helpful assistant' },
            { role: 'user', content: 'hi' }
          ]
        })
      }),
      createBaseEnv(),
      TEST_USER_ID
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_system_prompt')
  })

  test('handleHostedComplete rejects non-hosted taskKind → invalid_task_kind', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskKind: 'enrichment',
          messages: validMessages('nlu')
        })
      }),
      createBaseEnv(),
      TEST_USER_ID
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_task_kind')
  })

  test('handleHostedComplete returns daily_cap_exceeded when day limit reached', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const dayKey = `ai_usage_day:${TEST_USER_ID}:${new Date().toISOString().slice(0, 10)}`

    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: validMessages('nlu') })
      }),
      createBaseEnv({
        AI_HOSTED_DAILY_CAP: '1',
        AI_USAGE_KV: createKvMock({ [dayKey]: '1' }) as unknown as Env['AI_USAGE_KV']
      }),
      TEST_USER_ID
    )

    expect(response.status).toBe(429)
    const data = (await response.json()) as { error: string; dailyLimit: number }
    expect(data.error).toBe('daily_cap_exceeded')
    expect(data.dailyLimit).toBe(1)
  })

  test('handleHostedComplete returns quota_exceeded when limit reached', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const monthKey = `ai_usage:${TEST_USER_ID}:${new Date().toISOString().slice(0, 7)}`

    const response = await handleHostedComplete(
      new Request('http://localhost/api/ai/hosted/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: validMessages('nlu') })
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
    const monthKey = `ai_usage:${TEST_USER_ID}:${new Date().toISOString().slice(0, 7)}`
    const kv = createKvMock()

    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"folders":[]}' } }],
            usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 }
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
          body: JSON.stringify({ messages: validMessages('nlu'), maxTokens: 128 })
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
        taskKind: string
        tokensUsed?: number
        promptTokens?: number
        completionTokens?: number
        quota: { used: number; limit: number }
      }
      expect(data.text).toBe('{"folders":[]}')
      expect(data.provider).toBe('hosted')
      expect(data.model).toBe('deepseek-v4-flash')
      expect(data.taskKind).toBe('nlu')
      expect(data.tokensUsed).toBe(42)
      expect(data.promptTokens).toBe(30)
      expect(data.completionTokens).toBe(12)
      expect(data.quota.used).toBe(1)
      expect(await kv.get(monthKey)).toBe('1')
      expect(fetchMock).toHaveBeenCalled()
      const firstFetchCall = fetchMock.mock.calls[0] as Parameters<typeof fetch> | undefined
      const fetchInit = firstFetchCall?.[1]
      const requestBody = JSON.parse(String(fetchInit?.body)) as {
        thinking?: { type?: string }
        model?: string
      }
      expect(requestBody.thinking).toEqual({ type: 'disabled' })
      expect(requestBody.model).toBe('deepseek-v4-flash')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('taskKind=framing_nlg 走 AI_HOSTED_MODEL_NLG 覆盖', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const kv = createKvMock()
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: { total_tokens: 3 }
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
          body: JSON.stringify({
            messages: validMessages('framing_nlg', 'polish'),
            taskKind: 'framing_nlg',
            maxTokens: 64
          })
        }),
        createBaseEnv({
          AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
          AI_HOSTED_MODEL_NLG: 'deepseek-chat'
        }),
        TEST_USER_ID
      )

      expect(response.status).toBe(200)
      const data = (await response.json()) as { model: string; taskKind: string }
      expect(data.taskKind).toBe('framing_nlg')
      expect(data.model).toBe('deepseek-chat')
      const firstFetchCall = fetchMock.mock.calls[0] as Parameters<typeof fetch> | undefined
      const requestBody = JSON.parse(String(firstFetchCall?.[1]?.body)) as {
        model?: string
        max_tokens?: number
      }
      expect(requestBody.model).toBe('deepseek-chat')
      expect(requestBody.max_tokens).toBe(64)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('taskKind=narrow_polish 过大 maxTokens 钳到 128', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const kv = createKvMock()
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: { total_tokens: 2 }
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
          body: JSON.stringify({
            messages: validMessages('narrow_polish', 'polish'),
            taskKind: 'narrow_polish',
            maxTokens: 400
          })
        }),
        createBaseEnv({
          AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV']
        }),
        TEST_USER_ID
      )

      expect(response.status).toBe(200)
      const firstFetchCall = fetchMock.mock.calls[0] as Parameters<typeof fetch> | undefined
      const requestBody = JSON.parse(String(firstFetchCall?.[1]?.body)) as { max_tokens?: number }
      expect(requestBody.max_tokens).toBe(128)
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
    expect(data.limit).toBe(1000)
  })

  test('handleHostedQuota returns free tier limit when not pro', async () => {
    mock.module('../services/ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { handleHostedQuota } = await import('../handlers/ai-hosted')

    const response = await handleHostedQuota(
      new Request('http://localhost/api/ai/hosted/quota'),
      createBaseEnv(),
      TEST_USER_ID
    )

    expect(response.status).toBe(200)
    const data = (await response.json()) as { tier: string; limit: number; dailyLimit: number }
    expect(data.tier).toBe('free')
    expect(data.limit).toBe(60)
    expect(data.dailyLimit).toBe(10)
  })

  test('handleHostedComplete accepts valid parse messages（缺省 taskKind=nlu）', async () => {
    const { handleHostedComplete } = await importHostedHandlersAsPro()
    const originalFetch = globalThis.fetch
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"intent":"recall"}' } }],
            usage: { total_tokens: 10 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const response = await handleHostedComplete(
        new Request('http://localhost/api/ai/hosted/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: validMessages('nlu')
          })
        }),
        createBaseEnv(),
        TEST_USER_ID
      )

      expect(response.status).toBe(200)
      const data = (await response.json()) as { text: string; provider: string; taskKind: string }
      expect(data.provider).toBe('hosted')
      expect(data.taskKind).toBe('nlu')
      expect(data.text).toContain('intent')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
