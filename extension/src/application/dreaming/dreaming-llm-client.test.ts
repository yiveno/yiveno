import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => 'tok')
}))

import {
  requestDreamingCompileBatch,
  resolveDreamingCompileRowStatus
} from '@/application/dreaming/dreaming-llm-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('resolveDreamingCompileRowStatus', () => {
  it('有 status 时原样返回', () => {
    expect(resolveDreamingCompileRowStatus({ status: 'empty', propositions: [] })).toBe('empty')
    expect(resolveDreamingCompileRowStatus({ status: 'omitted', propositions: [] })).toBe('omitted')
  })

  it('旧 Worker 无 status：有命题→ok，无命题→dropped', () => {
    expect(resolveDreamingCompileRowStatus({ propositions: [{ text: 'x' }] })).toBe('ok')
    expect(resolveDreamingCompileRowStatus({ propositions: [] })).toBe('dropped')
  })
})

describe('requestDreamingCompileBatch usage', () => {
  it('成功响应带回拆分 usage', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              sourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              status: 'ok',
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
    expect(result.results[0]!.status).toBe('ok')
  })

  it('旧 Worker 无 status 且命题为空 → dropped（保护旧命题）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              sourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              propositions: []
            }
          ],
          model: 'deepseek-chat'
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
    expect(result.results[0]!.status).toBe('dropped')
  })
})
