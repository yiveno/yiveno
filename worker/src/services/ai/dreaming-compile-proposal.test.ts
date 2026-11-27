import { describe, expect, it } from 'bun:test'

import {
  DREAMING_BATCH_MAX_SOURCES,
  DreamingCompileRequestSchema,
  filterDreamingCompileResults,
  parseDreamingCompileText,
  type DreamingCompileSource
} from './dreaming-compile-proposal'

const SOURCE_ID = '22222222-2222-4222-8222-222222222222'

function makeSource(overrides: Partial<DreamingCompileSource> = {}): DreamingCompileSource {
  return {
    id: SOURCE_ID,
    type: 'text_excerpt',
    text: 'People organize information in personal libraries.',
    title: 'Personal Libraries Guide',
    note: 'saved for later recall',
    ...overrides
  }
}

describe('dreaming-compile-proposal', () => {
  it('batch 上限为 8', () => {
    expect(DREAMING_BATCH_MAX_SOURCES).toBe(8)
    const over = DreamingCompileRequestSchema.safeParse({
      sources: Array.from({ length: 9 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
        type: 'text_excerpt',
        text: 'hello world excerpt body'
      }))
    })
    expect(over.success).toBe(false)
  })

  it('无 sourceQuote 的命题在 parse 后仍可被上层滤掉；合法 JSON 可解析', () => {
    const raw = JSON.stringify({
      results: [
        {
          sourceId: SOURCE_ID,
          propositions: [
            {
              text: 'People organize information.',
              sourceQuote: 'organize information'
            }
          ]
        }
      ]
    })
    const parsed = parseDreamingCompileText(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.results[0]!.propositions[0]!.sourceQuote).toBe('organize information')
  })

  it('编造引用被丢弃 → status dropped', () => {
    const source = makeSource()
    const filtered = filterDreamingCompileResults(
      {
        results: [
          {
            sourceId: SOURCE_ID,
            propositions: [
              {
                text: 'Invented claim.',
                sourceQuote: 'this quote was never in the source'
              }
            ]
          }
        ]
      },
      [source],
      new Set([SOURCE_ID])
    )
    expect(filtered.results).toHaveLength(1)
    expect(filtered.results[0]!.status).toBe('dropped')
    expect(filtered.results[0]!.propositions).toHaveLength(0)
    expect(filtered.droppedQuoteCount).toBe(1)
  })

  it('逐字引用保留 → status ok', () => {
    const source = makeSource()
    const filtered = filterDreamingCompileResults(
      {
        results: [
          {
            sourceId: SOURCE_ID,
            propositions: [
              {
                text: 'People organize information.',
                sourceQuote: 'organize information'
              }
            ]
          }
        ]
      },
      [source],
      new Set([SOURCE_ID])
    )
    expect(filtered.results[0]!.status).toBe('ok')
    expect(filtered.results[0]!.propositions).toHaveLength(1)
    expect(filtered.droppedQuoteCount).toBe(0)
  })

  it('title 引用保留 → status ok', () => {
    const source = makeSource()
    const filtered = filterDreamingCompileResults(
      {
        results: [
          {
            sourceId: SOURCE_ID,
            propositions: [
              {
                text: 'About personal libraries.',
                sourceQuote: 'Personal Libraries'
              }
            ]
          }
        ]
      },
      [source],
      new Set([SOURCE_ID])
    )
    expect(filtered.results[0]!.status).toBe('ok')
    expect(filtered.results[0]!.propositions).toHaveLength(1)
    expect(filtered.droppedQuoteCount).toBe(0)
  })

  it('omitted：LLM 未返回该 source 时仍有一行且 status=omitted', () => {
    const source = makeSource()
    const filtered = filterDreamingCompileResults({ results: [] }, [source], new Set([SOURCE_ID]))
    expect(filtered.results).toHaveLength(1)
    expect(filtered.results[0]).toEqual({
      sourceId: SOURCE_ID,
      status: 'omitted',
      propositions: []
    })
    expect(filtered.droppedQuoteCount).toBe(0)
  })

  it('empty：LLM 返回行且 propositions 原本为 0', () => {
    const source = makeSource()
    const filtered = filterDreamingCompileResults(
      {
        results: [{ sourceId: SOURCE_ID, propositions: [] }]
      },
      [source],
      new Set([SOURCE_ID])
    )
    expect(filtered.results[0]!.status).toBe('empty')
    expect(filtered.results[0]!.propositions).toHaveLength(0)
    expect(filtered.droppedQuoteCount).toBe(0)
  })

  it('未知 sourceId 仍排除；请求 source 仍全覆盖为 omitted', () => {
    const source = makeSource()
    const unknownId = '33333333-3333-4333-8333-333333333333'
    const filtered = filterDreamingCompileResults(
      {
        results: [
          {
            sourceId: unknownId,
            propositions: [
              {
                text: 'Should not appear.',
                sourceQuote: 'organize information'
              }
            ]
          }
        ]
      },
      [source],
      new Set([SOURCE_ID])
    )
    expect(filtered.results).toHaveLength(1)
    expect(filtered.results[0]!.sourceId).toBe(SOURCE_ID)
    expect(filtered.results[0]!.status).toBe('omitted')
    expect(filtered.droppedQuoteCount).toBe(0)
  })
})
