/**
 * Gateway compat adapter：URL / 配置门禁 / 三档请求体 / key 选择 / usage / 空响应。
 */
import { describe, expect, mock, test } from 'bun:test'
import type { Env } from '../../types/env'
import { gatewayCompatAiChatProvider } from './gateway-compat-ai-chat-provider'

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    AI_GATEWAY_ACCOUNT_ID: 'acc-test',
    AI_GATEWAY_ID: 'yiveno',
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    AI_HOSTED_MODEL: 'deepseek/deepseek-flash',
    ...overrides
  } as unknown as Env
}

function okResponse(
  text: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text }, finish_reason: 'stop' }],
      ...(usage ? { usage } : {})
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
}

describe('gatewayCompatAiChatProvider · isConfigured', () => {
  test('Gateway + 任一厂商 key → true', () => {
    expect(gatewayCompatAiChatProvider.isConfigured(createEnv())).toBe(true)
    expect(
      gatewayCompatAiChatProvider.isConfigured(
        createEnv({ DEEPSEEK_API_KEY: '', OPENAI_API_KEY: 'openai-key' })
      )
    ).toBe(true)
    expect(
      gatewayCompatAiChatProvider.isConfigured(
        createEnv({ DEEPSEEK_API_KEY: '', GOOGLE_AI_API_KEY: 'google-key' })
      )
    ).toBe(true)
  })

  test('缺 Gateway env 或全部 key → false', () => {
    expect(gatewayCompatAiChatProvider.isConfigured(createEnv({ AI_GATEWAY_ACCOUNT_ID: '' }))).toBe(
      false
    )
    expect(gatewayCompatAiChatProvider.isConfigured(createEnv({ AI_GATEWAY_ID: '' }))).toBe(false)
    expect(
      gatewayCompatAiChatProvider.isConfigured(
        createEnv({
          DEEPSEEK_API_KEY: '',
          OPENAI_API_KEY: '',
          GOOGLE_AI_API_KEY: ''
        })
      )
    ).toBe(false)
  })
})

describe('gatewayCompatAiChatProvider · URL 与配置门禁', () => {
  test('URL 拼到 /compat/chat/completions', async () => {
    let hitUrl = ''
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      hitUrl = String(input)
      return okResponse('ok')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash'
      })
      expect(hitUrl).toBe(
        'https://gateway.ai.cloudflare.com/v1/acc-test/yiveno/compat/chat/completions'
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('缺 AI_GATEWAY_ACCOUNT_ID 抛明确配置错误（不发 fetch）', async () => {
    const fetchMock = mock(async () => okResponse('should-not-run'))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await expect(
        gatewayCompatAiChatProvider.complete(createEnv({ AI_GATEWAY_ACCOUNT_ID: '' }), {
          prompt: 'hello',
          model: 'deepseek/deepseek-flash'
        })
      ).rejects.toThrow('gateway_compat_misconfigured')
      expect(fetchMock).toHaveBeenCalledTimes(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('缺 AI_GATEWAY_ID 抛明确配置错误', async () => {
    await expect(
      gatewayCompatAiChatProvider.complete(createEnv({ AI_GATEWAY_ID: '' }), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash'
      })
    ).rejects.toThrow('gateway_compat_misconfigured')
  })

  test('模型无厂商前缀抛错', async () => {
    await expect(
      gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek-flash'
      })
    ).rejects.toThrow('gateway_compat_model_missing_provider_prefix')
  })
})

describe('gatewayCompatAiChatProvider · 三档请求体', () => {
  test('openai：max_completion_tokens + reasoning_effort:none；无 thinking', async () => {
    let body: Record<string, unknown> = {}
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = parseBody(init)
      return okResponse('openai-ok')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await gatewayCompatAiChatProvider.complete(
        createEnv({ OPENAI_API_KEY: 'openai-test-key', DEEPSEEK_API_KEY: '' }),
        {
          prompt: 'hello',
          model: 'openai/gpt-5-mini',
          disableThinking: true,
          maxTokens: 128
        }
      )
      expect(body.max_completion_tokens).toBe(128)
      expect(body).not.toHaveProperty('max_tokens')
      expect(body.reasoning_effort).toBe('none')
      expect(body).not.toHaveProperty('thinking')
      expect(body.temperature).toBe(0)
      expect(body.model).toBe('openai/gpt-5-mini')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('deepseek：max_tokens + thinking；无 reasoning_effort', async () => {
    let body: Record<string, unknown> = {}
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = parseBody(init)
      return okResponse('deepseek-ok')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash',
        disableThinking: true
      })
      expect(body.max_tokens).toBe(256)
      expect(body).not.toHaveProperty('max_completion_tokens')
      expect(body.thinking).toEqual({ type: 'disabled' })
      expect(body).not.toHaveProperty('reasoning_effort')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('deepseek：disableThinking=false → thinking.enabled', async () => {
    let body: Record<string, unknown> = {}
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = parseBody(init)
      return okResponse('deepseek-think')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash',
        disableThinking: false
      })
      expect(body.thinking).toEqual({ type: 'enabled' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('google-ai-studio：max_tokens；无 thinking / reasoning', async () => {
    let body: Record<string, unknown> = {}
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = parseBody(init)
      return okResponse('google-ok')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await gatewayCompatAiChatProvider.complete(
        createEnv({ GOOGLE_AI_API_KEY: 'google-test-key', DEEPSEEK_API_KEY: '' }),
        {
          prompt: 'hello',
          model: 'google-ai-studio/gemini-2.5-flash-lite',
          disableThinking: true
        }
      )
      expect(body.max_tokens).toBe(256)
      expect(body).not.toHaveProperty('max_completion_tokens')
      expect(body).not.toHaveProperty('thinking')
      expect(body).not.toHaveProperty('reasoning_effort')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('gatewayCompatAiChatProvider · key 选择与鉴权头', () => {
  test('按前缀选 key；恒发 collect-log-payload / skip-cache；有 token 加 cf-aig-authorization', async () => {
    const snapshots = {
      auth: '',
      aigAuth: '',
      collect: '',
      skipCache: ''
    }
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      snapshots.auth = headers.get('authorization') ?? ''
      snapshots.aigAuth = headers.get('cf-aig-authorization') ?? ''
      snapshots.collect = headers.get('cf-aig-collect-log-payload') ?? ''
      snapshots.skipCache = headers.get('cf-aig-skip-cache') ?? ''
      return okResponse('auth-ok')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      await gatewayCompatAiChatProvider.complete(
        createEnv({
          OPENAI_API_KEY: 'openai-secret',
          AI_GATEWAY_TOKEN: 'gw-token'
        }),
        { prompt: 'hello', model: 'openai/gpt-5-mini' }
      )
      expect(snapshots.auth).toBe('Bearer openai-secret')
      expect(snapshots.aigAuth).toBe('Bearer gw-token')
      expect(snapshots.collect).toBe('false')
      expect(snapshots.skipCache).toBe('true')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('对应 key 缺失抛明确错误（错误不含 key 值）', async () => {
    const fetchMock = mock(async () => okResponse('nope'))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      try {
        await gatewayCompatAiChatProvider.complete(
          createEnv({ OPENAI_API_KEY: '', DEEPSEEK_API_KEY: 'deepseek-only' }),
          { prompt: 'hello', model: 'openai/gpt-5-mini' }
        )
        expect.unreachable('应抛错')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('gateway_compat_api_key_missing')
        expect(msg).toContain('OPENAI_API_KEY')
        expect(msg).not.toContain('deepseek-only')
        expect(msg).not.toContain('openai-secret')
      }
      expect(fetchMock).toHaveBeenCalledTimes(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('gatewayCompatAiChatProvider · 响应与 usage', () => {
  test('usage 拆分；缺失不推算；providerId / model 正确', async () => {
    const fetchMock = mock(async () =>
      okResponse('usage-ok', {
        prompt_tokens: 11,
        completion_tokens: 7,
        total_tokens: 18
      })
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const result = await gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash'
      })
      expect(result.text).toBe('usage-ok')
      expect(result.providerId).toBe('gateway-compat')
      expect(result.model).toBe('deepseek/deepseek-flash')
      expect(result.promptTokens).toBe(11)
      expect(result.completionTokens).toBe(7)
      expect(result.tokensUsed).toBe(18)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('usage 全缺 → 结果不含 token 字段', async () => {
    const fetchMock = mock(async () => okResponse('no-usage'))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const result = await gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash'
      })
      expect(result.tokensUsed).toBeUndefined()
      expect(result.promptTokens).toBeUndefined()
      expect(result.completionTokens).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('content 空时回退 reasoning_content', async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: '  ', reasoning_content: 'from-reasoning' },
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
      const result = await gatewayCompatAiChatProvider.complete(createEnv(), {
        prompt: 'hello',
        model: 'deepseek/deepseek-flash'
      })
      expect(result.text).toBe('from-reasoning')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('空响应抛带厂商前缀的 empty_response（含 finish_reason）', async () => {
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
      await expect(
        gatewayCompatAiChatProvider.complete(createEnv(), {
          prompt: 'hello',
          model: 'deepseek/deepseek-flash'
        })
      ).rejects.toThrow('gateway_compat_empty_response:deepseek:length')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
