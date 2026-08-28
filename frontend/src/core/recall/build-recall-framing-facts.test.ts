import { describe, expect, it } from 'vitest'

import { buildRecallFramingFacts } from '@/core/recall/build-recall-framing-facts'
import { COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED } from '@/core/recall/compute-composer-placeholder'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

function excerpt(id: string, overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id,
    type: 'text_excerpt',
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    payload: {
      selectedText: `Excerpt body ${id}`,
      pageTitle: `Page ${id}`,
      domain: 'www.youtube.com',
      sourceUrl: `https://www.youtube.com/watch?v=${id}`
    },
    clues: {},
    ...overrides
  } as MemoryItem
}

function match(item: MemoryItem, fields: string[], score = 20): RecallMatch {
  return { item, score, matchedFields: fields }
}

function candidateResult(
  outcome: RecallResult['outcome'],
  pool: RecallMatch[],
  parsed?: RecallResult['parsed']
): RecallResult {
  return {
    outcome,
    topPick: outcome === 'top_pick' ? (pool[0] ?? null) : null,
    alsoPossible: outcome === 'top_pick' ? pool.slice(1) : pool,
    totalRankedCount: pool.length,
    clue: 'video',
    ...(parsed ? { parsed } : {})
  }
}

describe('buildRecallFramingFacts', () => {
  it('need_a_clue + video 类型邻域：含 P3 分桶与 ambiguity', () => {
    const pool = Array.from({ length: 8 }, (_, index) =>
      match(
        excerpt(`e-${index}`, {
          payload: {
            selectedText: `clip ${index}`,
            pageTitle: `Case study ${index}`,
            domain: index < 4 ? 'www.youtube.com' : 'linear.app',
            sourceUrl:
              index < 4
                ? `https://www.youtube.com/watch?v=${index}`
                : `https://linear.app/issue/${index}`
          }
        }),
        ['constraint_neighborhood'],
        12
      )
    )
    const result = candidateResult('need_a_clue', pool, {
      raw: 'video',
      objectTypes: ['video'],
      contentTerms: [],
      confidence: 'medium'
    })

    const facts = buildRecallFramingFacts(result)
    expect(facts?.kind).toBe('candidates')
    if (facts?.kind !== 'candidates') {
      return
    }
    expect(facts.retrievalPath).toBe('constraint_neighborhood')
    expect(facts.stance).toBe('weak_candidates')
    expect(facts.buckets.length).toBeGreaterThanOrEqual(2)
    expect(facts.ambiguity?.kind).toBe('type_mix')
    expect(facts.isWideNeighborhood).toBe(true)
  })

  it('top_pick 窄邻域：省略 P3 分桶', () => {
    const pool = [
      match(excerpt('a'), ['title', 'textExcerpt'], 24),
      match(excerpt('b'), ['textExcerpt'], 22)
    ]
    const result = candidateResult('top_pick', pool, {
      raw: 'deploy checklist',
      contentTerms: ['deploy', 'checklist'],
      confidence: 'high'
    })

    const facts = buildRecallFramingFacts(result)
    expect(facts?.kind).toBe('candidates')
    if (facts?.kind !== 'candidates') {
      return
    }
    expect(facts.stance).toBe('confident_neighborhood')
    expect(facts.buckets).toEqual([])
    expect(facts.isWideNeighborhood).toBe(false)
  })

  it('宽邻域 top_pick：N≥门槛时含 P3', () => {
    const pool = Array.from({ length: COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED }, (_, index) =>
      match(excerpt(`w-${index}`), ['textExcerpt'], 22)
    )
    const result = candidateResult('top_pick', pool, {
      raw: 'javascript',
      contentTerms: ['javascript'],
      confidence: 'medium'
    })

    const facts = buildRecallFramingFacts(result)
    expect(facts?.kind).toBe('candidates')
    if (facts?.kind !== 'candidates') {
      return
    }
    expect(facts.isWideNeighborhood).toBe(true)
    expect(facts.buckets.length).toBeGreaterThanOrEqual(1)
  })

  it('事实层保留听懂约束与检索路径', () => {
    const pool = [match(excerpt('x'), ['constraint_neighborhood'], 12)]
    const result = candidateResult('need_a_clue', pool, {
      raw: 'video',
      objectTypes: ['video'],
      contentTerms: [],
      confidence: 'low'
    })
    const facts = buildRecallFramingFacts(result)
    expect(facts?.kind).toBe('candidates')
    if (facts?.kind !== 'candidates') {
      return
    }
    expect(facts.understood.objectTypes).toContain('video')
    expect(facts.retrievalPath).toBe('constraint_neighborhood')
  })
})
