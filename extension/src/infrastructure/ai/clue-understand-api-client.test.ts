import { afterEach, describe, expect, it, vi } from 'vitest'

import { HostedCompleteError } from '@/core/recall/understand/clue-llm-failure-kind'

import {
  createClueUnderstandApiCompleter,
  createClueUnderstandApiCompleterDetailed
} from './clue-understand-api-client'

const messages = [{ role: 'user' as const, content: 'hi' }]
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function mockJsonResponse(status: number, body: Record<string, unknown>): void {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' }
    })
  ) as typeof fetch
}

describe('createClueUnderstandApiCompleter temperature 透传', () => {
  it('请求体 temperature 取 options.temperature ?? 0', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ text: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )
    globalThis.fetch = fetchMock as typeof fetch

    const complete = createClueUnderstandApiCompleter('http://localhost:8787')
    await complete(messages, { taskKind: 'nlu', temperature: 0.8 })
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body.temperature).toBe(0.8)

    await complete(messages, { taskKind: 'nlu' })
    const bodyDefault = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)
    expect(bodyDefault.temperature).toBe(0)
  })
})

describe('createClueUnderstandApiCompleterDetailed', () => {
  it('透传 Worker 拆分 prompt/completion token', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            text: 'ok',
            tokensUsed: 18,
            promptTokens: 10,
            completionTokens: 8
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
    )
    globalThis.fetch = fetchMock as typeof fetch

    const detailed = createClueUnderstandApiCompleterDetailed('http://localhost:8787')
    const result = await detailed(messages, { taskKind: 'nlu' })
    expect(result.text).toBe('ok')
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18
    })
  })
})

describe('代理 client HostedCompleteError kind 映射', () => {
  const detailed = () => createClueUnderstandApiCompleterDetailed('http://localhost:8787')

  it('fetch 抛 TypeError → kind network', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      name: 'HostedCompleteError',
      kind: 'network'
    } satisfies Partial<HostedCompleteError>)
  })

  it('fetch 抛 TimeoutError → kind timeout', async () => {
    const timeout = new Error('The operation was aborted due to timeout')
    timeout.name = 'TimeoutError'
    globalThis.fetch = vi.fn().mockRejectedValue(timeout) as typeof fetch
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'timeout',
      message: 'clue_complete_timeout'
    })
  })

  it('429 + quota_exceeded → kind quota_daily，且无 quota 快照（clue 端点无 daily 字段）', async () => {
    mockJsonResponse(429, { error: 'quota_exceeded', used: 200, limit: 200 })
    try {
      await detailed()(messages, { taskKind: 'nlu' })
      expect.fail('应抛 HostedCompleteError')
    } catch (error) {
      expect(error).toBeInstanceOf(HostedCompleteError)
      const typed = error as HostedCompleteError
      expect(typed.kind).toBe('quota_daily')
      expect(typed.status).toBe(429)
      expect(typed.quota).toBeUndefined()
    }
  })

  it('429 + 其它 error → unknown', async () => {
    mockJsonResponse(429, { error: 'something_else' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'unknown',
      status: 429
    })
  })

  it('500 → provider_error', async () => {
    mockJsonResponse(500, { error: 'clue_complete_failed' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'provider_error',
      status: 500
    })
  })

  it('503 + kv_not_configured → not_configured', async () => {
    mockJsonResponse(503, { error: 'kv_not_configured' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'not_configured',
      status: 503
    })
  })

  it('503 + ai_provider_not_configured → not_configured', async () => {
    mockJsonResponse(503, { error: 'ai_provider_not_configured' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'not_configured',
      status: 503
    })
  })

  it('503 + ai_provider_unsupported → unknown（端点特有；分类器无分支，诚实回落）', async () => {
    mockJsonResponse(503, { error: 'ai_provider_unsupported' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'unknown',
      status: 503
    })
  })

  it('403 + clue_proxy_disabled → unknown（端点特有；分类器无分支，诚实回落）', async () => {
    mockJsonResponse(403, { error: 'clue_proxy_disabled' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'unknown',
      status: 403
    })
  })

  it('200 空 text → empty_response', async () => {
    mockJsonResponse(200, { text: '   ' })
    await expect(detailed()(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'empty_response',
      message: 'clue_complete_empty',
      status: 200
    })
  })

  it('成功路径：text 与 usage 正常返回（回归）', async () => {
    mockJsonResponse(200, {
      text: 'parsed ok',
      promptTokens: 3,
      completionTokens: 2,
      tokensUsed: 5
    })
    const result = await detailed()(messages, { taskKind: 'nlu' })
    expect(result.text).toBe('parsed ok')
    expect(result.usage).toEqual({
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5
    })
  })
})
