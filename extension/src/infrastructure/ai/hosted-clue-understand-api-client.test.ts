import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createHostedClueUnderstandApiCompleter,
  createHostedClueUnderstandApiCompleterDetailed
} from './hosted-clue-understand-api-client'

const messages = [{ role: 'user' as const, content: 'hi' }]
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('createHostedClueUnderstandApiCompleter temperature 透传', () => {
  it('请求体 temperature 取 options.temperature ?? 0', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ text: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )
    globalThis.fetch = fetchMock as typeof fetch

    const complete = createHostedClueUnderstandApiCompleter(
      async () => 'token',
      'http://localhost:8787'
    )
    await complete(messages, { taskKind: 'nlu', temperature: 0.8 })
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body.temperature).toBe(0.8)

    await complete(messages, { taskKind: 'nlu' })
    const bodyDefault = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)
    expect(bodyDefault.temperature).toBe(0)
  })
})

describe('createHostedClueUnderstandApiCompleter 429 tier', () => {
  it('429 + anonymous → anonymous_quota_exhausted', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'quota_exceeded',
          tier: 'anonymous',
          used: 15,
          limit: 15,
          dailyUsed: 15,
          dailyLimit: 15
        }),
        { status: 429, headers: { 'content-type': 'application/json' } }
      )
    ) as typeof fetch

    const complete = createHostedClueUnderstandApiCompleter(
      async () => 'token',
      'http://localhost:8787'
    )
    await expect(complete(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'anonymous_quota_exhausted',
      name: 'HostedCompleteError'
    })
  })

  it('429 + free → quota_monthly（不变）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'quota_exceeded',
          tier: 'free',
          used: 60,
          limit: 60,
          dailyUsed: 5,
          dailyLimit: 20
        }),
        { status: 429, headers: { 'content-type': 'application/json' } }
      )
    ) as typeof fetch

    const complete = createHostedClueUnderstandApiCompleter(
      async () => 'token',
      'http://localhost:8787'
    )
    await expect(complete(messages, { taskKind: 'nlu' })).rejects.toMatchObject({
      kind: 'quota_monthly'
    })
  })
})

describe('createHostedClueUnderstandApiCompleterDetailed', () => {
  it('透传 Worker 拆分 prompt/completion token', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            text: 'ok',
            tokensUsed: 40,
            promptTokens: 25,
            completionTokens: 15
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
    )
    globalThis.fetch = fetchMock as typeof fetch

    const detailed = createHostedClueUnderstandApiCompleterDetailed(
      async () => 'token',
      'http://localhost:8787'
    )
    const result = await detailed(messages, { taskKind: 'nlu' })
    expect(result.text).toBe('ok')
    expect(result.usage).toEqual({
      promptTokens: 25,
      completionTokens: 15,
      totalTokens: 40
    })
  })
})
