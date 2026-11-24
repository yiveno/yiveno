/**
 * DeepSeek adapter：Gateway 路径关闭 payload 日志头；直连 / 回退直连不加该头。
 */
import { describe, expect, test, mock } from 'bun:test'
import type { Env } from '../../types/env'
import { deepseekAiChatProvider } from './deepseek-ai-chat-provider'

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    AI_HOSTED_MODEL: 'deepseek-flash',
    ...overrides
  } as unknown as Env
}

function okResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text }, finish_reason: 'stop' }]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

describe('deepseekAiChatProvider · cf-aig-collect-log-payload', () => {
  test('经 Gateway 时请求头含 cf-aig-collect-log-payload: false', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get('cf-aig-collect-log-payload')).toBe('false')
      return okResponse('gw-ok')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(
        createEnv({
          AI_GATEWAY_ACCOUNT_ID: 'acc-test',
          AI_GATEWAY_ID: 'yiveno'
        }),
        { prompt: 'hello' }
      )
      expect(result.text).toBe('gw-ok')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('直连路径请求头不含 cf-aig-collect-log-payload', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.has('cf-aig-collect-log-payload')).toBe(false)
      return okResponse('direct-ok')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(createEnv(), { prompt: 'hello' })
      expect(result.text).toBe('direct-ok')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('Gateway 401 回退直连时第二跳不含 cf-aig-collect-log-payload', async () => {
    const headerSnapshots: Array<boolean> = []
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      headerSnapshots.push(headers.has('cf-aig-collect-log-payload'))
      if (url.includes('gateway.ai.cloudflare.com')) {
        expect(headers.get('cf-aig-collect-log-payload')).toBe('false')
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
      }
      expect(headers.has('cf-aig-collect-log-payload')).toBe(false)
      return okResponse('fallback-ok')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(
        createEnv({
          AI_GATEWAY_ACCOUNT_ID: 'acc-test',
          AI_GATEWAY_ID: 'yiveno'
        }),
        { prompt: 'hello' }
      )
      expect(result.text).toBe('fallback-ok')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(headerSnapshots).toEqual([true, false])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
