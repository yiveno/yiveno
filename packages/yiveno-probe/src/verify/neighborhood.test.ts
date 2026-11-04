/**
 * 邻域对拍判定单测。
 */

import { describe, expect, it } from 'vitest'

import {
  judgeProbeNeighborhood,
  judgeProbeNeighborhoodForSet,
  rankedIdsFromRecallResult
} from './neighborhood'

describe('judgeProbeNeighborhood', () => {
  it('top1 / in_topk / miss', () => {
    expect(judgeProbeNeighborhood(['a', 'b', 'c'], 'a', 3)).toBe('top1')
    expect(judgeProbeNeighborhood(['a', 'b', 'c'], 'b', 3)).toBe('in_topk')
    expect(judgeProbeNeighborhood(['a', 'b', 'c'], 'c', 2)).toBe('miss')
    expect(judgeProbeNeighborhood(['a', 'b'], 'z', 3)).toBe('miss')
  })

  it('集合判定：preferred top1 / 任一成员 in_topk / miss', () => {
    expect(judgeProbeNeighborhoodForSet(['p', 'x', 'y'], ['p', 'a', 'b'], 'p', 3)).toBe('top1')
    expect(judgeProbeNeighborhoodForSet(['x', 'a', 'y'], ['p', 'a', 'b'], 'p', 3)).toBe('in_topk')
    expect(judgeProbeNeighborhoodForSet(['x', 'y', 'z'], ['p', 'a', 'b'], 'p', 3)).toBe('miss')
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
