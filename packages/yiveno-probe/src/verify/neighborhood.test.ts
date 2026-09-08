/**
 * 邻域对拍判定单测。
 */

import { describe, expect, it } from 'vitest'

import { judgeProbeNeighborhood, rankedIdsFromRecallResult } from './neighborhood'

describe('judgeProbeNeighborhood', () => {
  it('top1 / in_topk / miss', () => {
    expect(judgeProbeNeighborhood(['a', 'b', 'c'], 'a', 3)).toBe('top1')
    expect(judgeProbeNeighborhood(['a', 'b', 'c'], 'b', 3)).toBe('in_topk')
    expect(judgeProbeNeighborhood(['a', 'b', 'c'], 'c', 2)).toBe('miss')
    expect(judgeProbeNeighborhood(['a', 'b'], 'z', 3)).toBe('miss')
  })

  it('rankedIdsFromRecallResult 保持顺序', () => {
    expect(
      rankedIdsFromRecallResult({
        topPick: { item: { id: 't' } },
        alsoPossible: [{ item: { id: 'a' } }, { item: { id: 'b' } }]
      })
    ).toEqual(['t', 'a', 'b'])
  })
})
