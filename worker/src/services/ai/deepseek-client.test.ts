import { describe, expect, test, mock } from 'bun:test'
import type { Env } from '../../types/env'

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    AI_HOSTED_MODEL: 'deepseek-v4-flash',
    ...overrides
  } as unknown as Env
}

describe('completeWithDeepSeek', () => {
  test('默认关闭思考模式并返回 content', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        thinking?: { type?: string }
      }
      expect(body.thinking).toEqual({ type: 'disabled' })

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      const result = await completeWithDeepSeek(createEnv(), 'hello', { maxTokens: 64 })

      expect(result.text).toBe('{"ok":true}')
      expect(result.model).toBe('deepseek-v4-flash')
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('content 为空时回退 reasoning_content', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: '', reasoning_content: '{"ok":true}' },
                finish_reason: 'stop'
              }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      const result = await completeWithDeepSeek(createEnv(), 'hello')

      expect(result.text).toBe('{"ok":true}')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('content 与 reasoning_content 均为空时抛出 finish_reason', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '' }, finish_reason: 'length' }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      await expect(completeWithDeepSeek(createEnv(), 'hello')).rejects.toThrow(
        'deepseek_empty_response:length'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('maxTokens 超过硬上限时钳制到 AI_MAX_COMPLETION_TOKENS', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { max_tokens?: number }
      expect(body.max_tokens).toBe(1024)

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      await completeWithDeepSeek(createEnv(), 'hello', { maxTokens: 99999 })
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('配置 AI Gateway 时请求打到 gateway.ai.cloudflare.com', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toBe(
        'https://gateway.ai.cloudflare.com/v1/acc-test/yiveno/deepseek/chat/completions'
      )
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'gw-ok' }, finish_reason: 'stop' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      const result = await completeWithDeepSeek(
        createEnv({
          AI_GATEWAY_ACCOUNT_ID: 'acc-test',
          AI_GATEWAY_ID: 'yiveno'
        }),
        'hello'
      )
      expect(result.text).toBe('gw-ok')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('Gateway 401 且无 AI_GATEWAY_TOKEN 时回退直连', async () => {
    const urls: string[] = []
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      if (url.includes('gateway.ai.cloudflare.com')) {
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'direct-ok' }, finish_reason: 'stop' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      const result = await completeWithDeepSeek(
        createEnv({
          AI_GATEWAY_ACCOUNT_ID: 'acc-test',
          AI_GATEWAY_ID: 'yiveno'
        }),
        'hello'
      )
      expect(result.text).toBe('direct-ok')
      expect(urls[0]).toContain('gateway.ai.cloudflare.com')
      expect(urls[1]).toContain('api.deepseek.com')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('有 AI_GATEWAY_TOKEN 时带上 cf-aig-authorization', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get('cf-aig-authorization')).toBe('Bearer cf-aig-test-token')
      expect(headers.get('authorization')).toBe('Bearer deepseek-test-key')
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'authed-ok' }, finish_reason: 'stop' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const { completeWithDeepSeek } = await import('./deepseek-client')
      const result = await completeWithDeepSeek(
        createEnv({
          AI_GATEWAY_ACCOUNT_ID: 'acc-test',
          AI_GATEWAY_ID: 'yiveno',
          AI_GATEWAY_TOKEN: 'cf-aig-test-token'
        }),
        'hello'
      )
      expect(result.text).toBe('authed-ok')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
