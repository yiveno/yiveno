import { describe, expect, it } from 'vitest'

import {
  cosineSimilarity,
  preferKeywordLeaderInHybridFusion,
  rankIdsByCosineToQuery,
  reciprocalRankFusion,
  scoreFromCosineSimilarity,
  sortIdsByRrf
} from '@/core/recall/hybrid-fusion'

describe('cosineSimilarity', () => {
  it('相同单位向量 → 1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
  })

  it('正交 → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('维度不一致 → 0', () => {
    expect(cosineSimilarity([1], [1, 0])).toBe(0)
  })
})

describe('reciprocalRankFusion', () => {
  it('两路都靠前的 id 分更高', () => {
    const scores = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['a', 'c', 'b']
    ])
    expect(scores.get('a')!).toBeGreaterThan(scores.get('b')!)
    expect(scores.get('a')!).toBeGreaterThan(scores.get('c')!)
  })

  it('sortIdsByRrf 返回降序', () => {
    const ordered = sortIdsByRrf([
      ['x', 'y'],
      ['y', 'x']
    ])
    expect(ordered[0]).toBe('x')
  })

  it('关键词池为空时仍保留语义近邻 id', () => {
    expect(sortIdsByRrf([[], ['semantic-only']])).toEqual(['semantic-only'])
  })
})

describe('rankIdsByCosineToQuery', () => {
  it('收入不在关键词池里、但更贴近 query 的条目', () => {
    const query = [1, 0]
    const ranked = rankIdsByCosineToQuery(query, [
      { id: 'keyword-hit', embedding: [0.2, 0.98] },
      { id: 'semantic-only', embedding: [0.99, 0.1] }
    ])
    expect(ranked[0]?.id).toBe('semantic-only')
    expect(ranked.map(entry => entry.id)).toContain('semantic-only')
  })

  it('低于阈值的噪声不入近邻', () => {
    const ranked = rankIdsByCosineToQuery([1, 0], [{ id: 'noise', embedding: [0, 1] }], {
      minSimilarity: 0.28
    })
    expect(ranked).toEqual([])
  })
})

describe('scoreFromCosineSimilarity', () => {
  it('0.4 余弦映射到可过 Top Pick 下限的分数', () => {
    expect(scoreFromCosineSimilarity(0.4)).toBe(20)
  })
})

describe('preferKeywordLeaderInHybridFusion', () => {
  it('词面领先分差够大时拉回融合首位', () => {
    const fused = [
      { id: 'semantic-rival', score: 100 },
      { id: 'keyword-leader', score: 95 }
    ]
    const keyword = [
      { id: 'keyword-leader', score: 92 },
      { id: 'semantic-rival', score: 66 }
    ]
    const ordered = preferKeywordLeaderInHybridFusion(fused, keyword)
    expect(ordered[0]?.id).toBe('keyword-leader')
    expect(ordered[0]!.score).toBeGreaterThan(ordered[1]!.score)
  })

  it('分差不足时不改序', () => {
    const fused = [
      { id: 'a', score: 80 },
      { id: 'b', score: 78 }
    ]
    const keyword = [
      { id: 'b', score: 50 },
      { id: 'a', score: 48 }
    ]
    expect(preferKeywordLeaderInHybridFusion(fused, keyword).map(e => e.id)).toEqual(['a', 'b'])
  })
})
