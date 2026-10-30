import { describe, expect, it } from 'vitest'

import {
  formatEvalFailureObservationLine,
  observeEvalFailure,
  rankedIdsFromRecallResult
} from '@/core/recall/eval/eval-failure-observation'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 仅供观察单测：只需要 item.id 可读。 */
function matchWithId(id: string): RecallMatch {
  return {
    item: { id } as MemoryItem,
    score: 1,
    matchedFields: ['title']
  }
}

function resultWithIds(ids: string[], outcome: RecallResult['outcome'] = 'top_pick'): RecallResult {
  const [first, ...rest] = ids
  return {
    outcome,
    topPick: first ? matchWithId(first) : null,
    alsoPossible: rest.map(matchWithId),
    totalRankedCount: ids.length,
    clue: 'x'
  }
}

describe('observeEvalFailure', () => {
  it('通过 → not_applicable，根因恒 null', () => {
    const obs = observeEvalFailure({
      passed: true,
      expectationKind: 'top1',
      expectedId: 'g',
      result: resultWithIds(['g'])
    })
    expect(obs.observedStage).toBe('not_applicable')
    expect(obs.inferredRootCause).toBeNull()
    expect(obs.rootCausePolicy).toBe('not_inferred')
  })

  it('期望 no_match 失败 → expectation_failed，不贴 Embedding 细码', () => {
    const obs = observeEvalFailure({
      passed: false,
      expectationKind: 'no_match',
      result: resultWithIds(['a'])
    })
    expect(obs.observedStage).toBe('expectation_failed')
    expect(obs.detailCodes).toEqual([])
    expect(obs.inferredRootCause).toBeNull()
    expect(obs.summaryZh).not.toMatch(/[Ee]mbedding/)
  })

  it('金标不在邻域 → candidate_miss，且无 weak_index（未传候选池）', () => {
    const obs = observeEvalFailure({
      passed: false,
      expectationKind: 'in_topk',
      expectedId: 'gold',
      result: resultWithIds(['a', 'b', 'c'])
    })
    expect(obs.observedStage).toBe('candidate_miss')
    expect(obs.detailCodes).toEqual(['miss_neighborhood'])
    expect(obs.detailCodes).not.toContain('weak_index')
    expect(obs.inferredRootCause).toBeNull()
  })

  it('期望 Top1 但金标在首屏第 2 位 → rank_wrong 观察', () => {
    const obs = observeEvalFailure({
      passed: false,
      expectationKind: 'top1',
      expectedId: 'gold',
      result: resultWithIds(['other', 'gold', 'c'])
    })
    expect(obs.observedStage).toBe('rank_wrong')
    expect(obs.neighborhoodRank).toBe(1)
    expect(obs.inFirstScreen).toBe(true)
    expect(obs.inferredRootCause).toBeNull()
  })

  it('期望 Top1 且金标已是首位但 outcome 不符 → expectation_failed', () => {
    const obs = observeEvalFailure({
      passed: false,
      expectationKind: 'top1',
      expectedId: 'gold',
      result: resultWithIds(['gold'], 'need_a_clue')
    })
    expect(obs.observedStage).toBe('expectation_failed')
    expect(obs.neighborhoodRank).toBe(0)
  })

  it('金标未入库观察 → not_captured', () => {
    const obs = observeEvalFailure({
      passed: false,
      expectationKind: 'top1',
      expectedId: 'gold',
      goldInLibrary: false,
      result: resultWithIds(['a'])
    })
    expect(obs.observedStage).toBe('not_captured')
  })

  it('format 行含 observedStage 与 not_inferred', () => {
    const obs = observeEvalFailure({
      passed: false,
      expectationKind: 'in_topk',
      expectedId: 'gold',
      result: resultWithIds(['a'])
    })
    const line = formatEvalFailureObservationLine('case-1', obs)
    expect(line).toContain('case-1:')
    expect(line).toContain('observedStage=candidate_miss')
    expect(line).toContain('rootCause=not_inferred')
  })
})

describe('rankedIdsFromRecallResult', () => {
  it('null → []；顺序 topPick → alsoPossible', () => {
    expect(rankedIdsFromRecallResult(null)).toEqual([])
    expect(rankedIdsFromRecallResult(resultWithIds(['a', 'b']))).toEqual(['a', 'b'])
  })
})
