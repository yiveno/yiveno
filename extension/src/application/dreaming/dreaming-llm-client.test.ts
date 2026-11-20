import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => 'tok')
}))

import { requestDreamingCompileBatch } from '@/application/dreaming/dreaming-llm-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('requestDreamingCompileBatch usage', () => {
  it('成功响应带回拆分 usage', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              sourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              propositions: [{ text: 'A claim.', sourceQuote: 'A claim.', topicAnchor: [] }]
            }
          ],
          model: 'deepseek-chat',
          tokensUsed: 90,
          promptTokens: 70,
          completionTokens: 20
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as typeof fetch

    const result = await requestDreamingCompileBatch([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        type: 'text_excerpt',
        text: 'A claim.'
      }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.usage).toEqual({
      promptTokens: 70,
      completionTokens: 20,
      totalTokens: 90
    })
  })
})
