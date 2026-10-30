import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  completeOpenAiCompatibleChatDetailed,
  resolveOpenAiCompatibleChatCompletionsUrl
} from './openai-compatible-chat'

const messages = [{ role: 'user' as const, content: 'parse this' }]
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function mockFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    )
  globalThis.fetch = fetchMock as typeof fetch
  return fetchMock
}

describe('resolveOpenAiCompatibleChatCompletionsUrl', () => {
  it('appends /v1/chat/completions when base has no version suffix', () => {
    expect(resolveOpenAiCompatibleChatCompletionsUrl('https://api.deepseek.com')).toBe(
      'https://api.deepseek.com/v1/chat/completions'
    )
  })

  it('does not double /v1 when base already ends with /v1', () => {
    expect(resolveOpenAiCompatibleChatCompletionsUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
  })

  it('keeps DashScope compatible-mode/v1 without doubling', () => {
    expect(
      resolveOpenAiCompatibleChatCompletionsUrl(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/'
      )
    ).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
  })
})

describe('completeOpenAiCompatibleChatDetailed request profiles', () => {
  it('sends an OpenAI-compatible reasoning-safe body', async () => {
    const fetchMock = mockFetch()
    await completeOpenAiCompatibleChatDetailed(
      {
        apiKey: 'test',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-5.4-mini',
        compat: 'openai'
      },
      messages
    )

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body).toMatchObject({
      model: 'gpt-5.4-mini',
      messages,
      max_completion_tokens: 400,
      temperature: 0,
      reasoning_effort: 'none'
    })
    expect(body).not.toHaveProperty('max_tokens')
    expect(body).not.toHaveProperty('thinking')
  })

  it('keeps the default DeepSeek request body unchanged', async () => {
    const fetchMock = mockFetch()
    await completeOpenAiCompatibleChatDetailed(
      { apiKey: 'test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      messages
    )

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      model: 'deepseek-chat',
      messages,
      max_tokens: 400,
      temperature: 0,
      thinking: { type: 'disabled' }
    })
  })

  it('sends a DashScope body without thinking or reasoning_effort', async () => {
    const fetchMock = mockFetch()
    await completeOpenAiCompatibleChatDetailed(
      {
        apiKey: 'test',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-flash',
        compat: 'dashscope'
      },
      messages
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    )
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body).toEqual({
      model: 'qwen-flash',
      messages,
      max_tokens: 400,
      temperature: 0
    })
    expect(body).not.toHaveProperty('thinking')
    expect(body).not.toHaveProperty('reasoning_effort')
    expect(body).not.toHaveProperty('enable_thinking')
    expect(body).not.toHaveProperty('max_completion_tokens')
  })
})
