/**
 * DeepSeek adapter：Gateway 跳缓存 / 关 payload 日志；401 回退日志与原因区分。
 */
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
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

function gatewayEnv(): Env {
  return createEnv({
    AI_GATEWAY_ACCOUNT_ID: 'acc-test',
    AI_GATEWAY_ID: 'yiveno'
  })
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
      const result = await deepseekAiChatProvider.complete(gatewayEnv(), { prompt: 'hello' })
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
      const result = await deepseekAiChatProvider.complete(gatewayEnv(), { prompt: 'hello' })
      expect(result.text).toBe('fallback-ok')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(headerSnapshots).toEqual([true, false])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('deepseekAiChatProvider · cf-aig-skip-cache（S2）', () => {
  test('经 Gateway 时请求头含 cf-aig-skip-cache: true', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get('cf-aig-skip-cache')).toBe('true')
      return okResponse('gw-skip-cache')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(gatewayEnv(), { prompt: 'hello' })
      expect(result.text).toBe('gw-skip-cache')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('直连路径请求头不含 cf-aig-skip-cache', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.has('cf-aig-skip-cache')).toBe(false)
      return okResponse('direct-no-skip')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(createEnv(), { prompt: 'hello' })
      expect(result.text).toBe('direct-no-skip')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('Gateway 401 回退直连时第二跳不含 cf-aig-skip-cache（第一跳含）', async () => {
    const skipCacheSnapshots: Array<boolean> = []
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      skipCacheSnapshots.push(headers.has('cf-aig-skip-cache'))
      if (url.includes('gateway.ai.cloudflare.com')) {
        expect(headers.get('cf-aig-skip-cache')).toBe('true')
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
      }
      expect(headers.has('cf-aig-skip-cache')).toBe(false)
      return okResponse('fallback-no-skip')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(gatewayEnv(), { prompt: 'hello' })
      expect(result.text).toBe('fallback-no-skip')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(skipCacheSnapshots).toEqual([true, false])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('deepseekAiChatProvider · 401 回退日志与原因区分（S6）', () => {
  let warnSpy: ReturnType<typeof spyOn>
  const prevLogOverride = process.env.WORKER_TEST_LOGS

  beforeEach(() => {
    process.env.WORKER_TEST_LOGS = '1'
    warnSpy = spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
    if (prevLogOverride === undefined) {
      delete process.env.WORKER_TEST_LOGS
    } else {
      process.env.WORKER_TEST_LOGS = prevLogOverride
    }
  })

  function parseWarnLogs(): Array<Record<string, unknown>> {
    return warnSpy.mock.calls
      .map(call => {
        const raw = call[0]
        if (typeof raw !== 'string') return null
        try {
          return JSON.parse(raw) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null)
  }

  test('Gateway 401 触发回退时记结构化日志（含成因与路径，不含 prompt）', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('gateway.ai.cloudflare.com')) {
        return new Response(
          JSON.stringify({ error: { message: 'Unauthorized', code: 'auth_required' } }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
      }
      return okResponse('fallback-logged')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await deepseekAiChatProvider.complete(gatewayEnv(), {
        prompt: 'secret-prompt-must-not-appear'
      })
      expect(result.text).toBe('fallback-logged')

      const logs = parseWarnLogs()
      const fallbackLog = logs.find(e => e.message === 'deepseek_gateway_401_fallback_direct')
      expect(fallbackLog).toBeDefined()
      expect(fallbackLog?.authFailCause).toBe('gateway_auth')
      expect(fallbackLog?.path).toBe('direct_retry')
      expect(fallbackLog?.status).toBe(401)
      expect(fallbackLog?.errorCode).toBe('auth_required')
      expect(fallbackLog?.model).toBe('deepseek-flash')

      const joined = JSON.stringify(logs)
      expect(joined).not.toContain('secret-prompt-must-not-appear')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('Gateway 401 且错误码 2009 时错误文案指明 provider 拒 key', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('gateway.ai.cloudflare.com')) {
        return new Response(JSON.stringify({ error: { message: 'Invalid API key', code: 2009 } }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: { message: 'Invalid API key', code: '2009' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      try {
        await deepseekAiChatProvider.complete(gatewayEnv(), { prompt: 'hello' })
        expect.unreachable('应抛错')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('deepseek_api_key_rejected')
        expect(msg).toContain('DeepSeek 拒绝了 API key')
        expect(msg).toContain('2009')
        expect(msg).not.toContain('Authenticated Gateway')
        expect(msg).not.toContain('AI_GATEWAY_TOKEN')
      }

      const logs = parseWarnLogs()
      const fallbackLog = logs.find(e => e.message === 'deepseek_gateway_401_fallback_direct')
      expect(fallbackLog?.authFailCause).toBe('provider_key_rejected')
      expect(fallbackLog?.errorCode).toBe(2009)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('Gateway 401 且无 2009 码时错误文案仍为网关鉴权（有 token → 不回退）', async () => {
    // 无 token 时 401 必走回退，formatUpstreamError(viaGateway=true, 无 token) 在 complete 抛错路径不可达；
    // 有 token 时走通用错误分支，非 2009 的 401 保持网关鉴权文案（现有行为）。
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      try {
        await deepseekAiChatProvider.complete(
          createEnv({
            AI_GATEWAY_ACCOUNT_ID: 'acc-test',
            AI_GATEWAY_ID: 'yiveno',
            AI_GATEWAY_TOKEN: 'gw-token'
          }),
          { prompt: 'hello' }
        )
        expect.unreachable('应抛错')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('ai_gateway_unauthorized')
        expect(msg).toContain('AI_GATEWAY_TOKEN')
        expect(msg).not.toContain('deepseek_api_key_rejected')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('直连重试失败时错误归因到直连实际状态（非 401）', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('gateway.ai.cloudflare.com')) {
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: { message: 'upstream_overloaded' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      })
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      try {
        await deepseekAiChatProvider.complete(gatewayEnv(), { prompt: 'hello' })
        expect.unreachable('应抛错')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('upstream_overloaded')
        expect(msg).toContain('直连回退亦失败')
        expect(msg).not.toContain('Authenticated Gateway')
        expect(msg).not.toContain('ai_gateway_unauthorized')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
