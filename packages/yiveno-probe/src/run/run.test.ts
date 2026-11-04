/**
 * 批量探针用例展开 / 聚合 / diff 单测。
 */

import { describe, expect, it } from 'vitest'

import {
  aggregateProbeBatchResults,
  buildProbeBatchCasePlan,
  diffProbeBatchAggregates,
  percentile,
  sortProbeResultsFailuresFirst
} from './index'
import type { ProbeBatchCaseResult } from './types'

function stubResult(
  partial: Partial<ProbeBatchCaseResult> &
    Pick<ProbeBatchCaseResult, 'caseId' | 'verdict' | 'persona' | 'source'>
): ProbeBatchCaseResult {
  return {
    clue: 'c',
    clueType: 'verbatim',
    expectedKey: 'k',
    expectedId: 'id',
    kind: 'bookmark',
    label: 'L',
    actualTop1Title: null,
    latencyMs: 10,
    ...partial
  }
}

describe('percentile', () => {
  it('空 / 单点 / 插值', () => {
    expect(percentile([], 0.5)).toBe(0)
    expect(percentile([7], 0.95)).toBe(7)
    expect(percentile([0, 10], 0.5)).toBe(5)
  })
})

describe('buildProbeBatchCasePlan', () => {
  it('精选线索非空；diversity 仅带线索条目；同 seed 可复现', () => {
    const a = buildProbeBatchCasePlan({
      personas: ['researcher'],
      fillerSeed: 20260906,
      diversityBookmarkCount: 20,
      diversityExcerptCount: 10
    })
    const b = buildProbeBatchCasePlan({
      personas: ['researcher'],
      fillerSeed: 20260906,
      diversityBookmarkCount: 20,
      diversityExcerptCount: 10
    })
    expect(a.length).toBeGreaterThan(0)
    expect(a.every(row => row.clue.trim().length > 0)).toBe(true)
    expect(a.filter(row => row.source === 'curated').length).toBeGreaterThan(0)
    expect(a).toEqual(b)
  })
})

describe('aggregateProbeBatchResults', () => {
  it('cluster 集合 / 负例进入专节；不进 judged', () => {
    const agg = aggregateProbeBatchResults([
      stubResult({
        caseId: 'set',
        verdict: 'in_topk',
        persona: 'developer',
        source: 'cluster',
        clueType: 'ambiguous',
        expectedIds: ['a', 'b'],
        latencyMs: 4
      }),
      stubResult({
        caseId: 'neg',
        verdict: 'false_positive',
        persona: 'developer',
        source: 'negative',
        kind: 'negative',
        clueType: 'associative',
        latencyMs: 5
      }),
      stubResult({
        caseId: 'ok',
        verdict: 'top1',
        persona: 'developer',
        source: 'curated',
        latencyMs: 3
      })
    ])
    expect(agg.judged).toBe(2)
    expect(agg.clusters.total).toBe(1)
    expect(agg.clusters.anyHitCount).toBe(1)
    expect(agg.negatives.total).toBe(1)
    expect(agg.negatives.falsePositiveCount).toBe(1)
    expect(agg.byClueType.ambiguous?.in_topk).toBe(1)
    expect(agg.cases.map(r => r.verdict)[0]).toBe('false_positive')
  })

  it('失败优先排序 + 率计算 + unmapped 单列', () => {
    const rows: ProbeBatchCaseResult[] = [
      stubResult({
        caseId: '1',
        verdict: 'top1',
        persona: 'developer',
        source: 'curated',
        latencyMs: 5
      }),
      stubResult({
        caseId: '2',
        verdict: 'miss',
        persona: 'developer',
        source: 'diversity',
        latencyMs: 20
      }),
      stubResult({
        caseId: '3',
        verdict: 'unmapped',
        persona: 'researcher',
        source: 'curated',
        expectedId: null,
        latencyMs: 1
      }),
      stubResult({
        caseId: '4',
        verdict: 'in_topk',
        persona: 'researcher',
        source: 'curated',
        latencyMs: 8
      })
    ]
    const agg = aggregateProbeBatchResults(rows)
    expect(agg.cases.map(r => r.verdict)).toEqual(['unmapped', 'miss', 'in_topk', 'top1'])
    expect(agg.judged).toBe(3)
    expect(agg.top1Rate).toBeCloseTo(1 / 3)
    expect(agg.inTop3Rate).toBeCloseTo(2 / 3)
    expect(agg.missRate).toBeCloseTo(1 / 3)
    expect(agg.unmappedCount).toBe(1)
    expect(agg.bySource.curated?.total).toBe(3)
    expect(agg.bySource.diversity?.miss).toBe(1)
  })
})

describe('sortProbeResultsFailuresFirst', () => {
  it('同失败档按耗时降序', () => {
    const sorted = sortProbeResultsFailuresFirst([
      stubResult({
        caseId: 'a',
        verdict: 'miss',
        persona: 'creator',
        source: 'curated',
        latencyMs: 3
      }),
      stubResult({
        caseId: 'b',
        verdict: 'miss',
        persona: 'creator',
        source: 'curated',
        latencyMs: 30
      })
    ])
    expect(sorted.map(r => r.caseId)).toEqual(['b', 'a'])
  })
})

describe('diffProbeBatchAggregates', () => {
  it('产出 rate / latency delta', () => {
    const base = aggregateProbeBatchResults([
      stubResult({
        caseId: '1',
        verdict: 'top1',
        persona: 'developer',
        source: 'curated',
        latencyMs: 10
      }),
      stubResult({
        caseId: '2',
        verdict: 'miss',
        persona: 'developer',
        source: 'curated',
        latencyMs: 20
      })
    ])
    const next = aggregateProbeBatchResults([
      stubResult({
        caseId: '1',
        verdict: 'top1',
        persona: 'developer',
        source: 'curated',
        latencyMs: 12
      }),
      stubResult({
        caseId: '2',
        verdict: 'top1',
        persona: 'developer',
        source: 'curated',
        latencyMs: 14
      })
    ])
    const diff = diffProbeBatchAggregates({
      beforeRunId: 'a',
      afterRunId: 'b',
      before: base,
      after: next
    })
    const top1 = diff.rows.find(r => r.metric === 'top1Rate')
    expect(top1?.delta).toBeCloseTo(0.5)
    expect(diff.rows.some(r => r.metric === 'latencyMs.p50')).toBe(true)
  })
})
