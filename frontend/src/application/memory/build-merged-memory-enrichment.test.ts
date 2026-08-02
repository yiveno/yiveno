import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildMergedMemoryEnrichment } from '@/application/memory/build-merged-memory-enrichment'

describe('buildMergedMemoryEnrichment', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('默认仅规则路径', async () => {
    const result = await buildMergedMemoryEnrichment({
      source: {
        title: '希特勒死亡80年後－ BBC',
        url: 'https://www.youtube.com/watch?v=x',
        domain: 'youtube.com'
      }
    })
    expect(result.path).toBe('rule_only')
    expect(result.proposal).toBeNull()
    expect(result.merged.tags).toContain('video')
    expect(result.merged.entities).toEqual(expect.arrayContaining(['Hitler', 'BBC']))
  })

  it('LLM 成功时走 rule_plus_llm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              proposal: {
                objectType: 'video',
                keywords: ['war', 'documentary'],
                entities: ['BBC'],
                summary: 'WWII related BBC video'
              },
              providerId: 'deepseek',
              model: 'deepseek-v4-flash',
              tokensUsed: 20
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
      )
    )

    const result = await buildMergedMemoryEnrichment({
      source: {
        title: '希特勒死亡80年後',
        url: 'https://www.youtube.com/watch?v=x',
        domain: 'youtube.com'
      },
      requestLlmProposal: true
    })
    expect(result.path).toBe('rule_plus_llm')
    expect(result.proposal?.keywords).toEqual(expect.arrayContaining(['war', 'documentary']))
    expect(result.merged.keywords).toEqual(expect.arrayContaining(['war', 'wwii']))
    expect(result.merged.summary).toBe('WWII related BBC video')
  })

  it('LLM 失败降级规则', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network_down')
      })
    )

    const result = await buildMergedMemoryEnrichment({
      source: {
        title: 'Lo-fi',
        url: 'https://www.youtube.com/watch?v=y',
        domain: 'youtube.com'
      },
      requestLlmProposal: true
    })
    expect(result.path).toBe('llm_failed_degraded')
    expect(result.merged.tags).toContain('video')
  })
})
