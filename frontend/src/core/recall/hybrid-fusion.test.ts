import { describe, expect, it } from 'vitest'

import { cosineSimilarity, reciprocalRankFusion, sortIdsByRrf } from '@/core/recall/hybrid-fusion'

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
})
