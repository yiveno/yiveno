import { describe, expect, it } from 'vitest'

import {
  compareRetrievalAblationToBaseline,
  extractAblationGatedMetrics,
  extractRetrievalAblationReport,
  formatRetrievalAblationBaselineCompareSummary
} from '@/core/recall/eval/compare-retrieval-ablation-baseline'
import type { RetrievalAblationReport } from '@/core/recall/eval/run-retrieval-ablation'

function fakeAgg(overrides: {
  recallAt1: number
  recallAt5: number
  mrr: number
  ndcgAt5: number
}): NonNullable<RetrievalAblationReport['aggregateHitCases']['hybrid']> {
  return {
    recallAt1: overrides.recallAt1,
    recallAt5: overrides.recallAt5,
    recallAt10: overrides.recallAt5,
    mrr: overrides.mrr,
    ndcgAt5: overrides.ndcgAt5,
    ndcgAt10: overrides.ndcgAt5,
    denominator: 11,
    candidateMissCount: 0,
    inPoolOutsideTop5Count: 0,
    inPoolNotTop1Count: 0,
    recallAt5HitCount: 11
  }
}

function fakeNeg(
  rate: number
): NonNullable<RetrievalAblationReport['aggregateNegative']['hybrid']> {
  return {
    caseCount: 11,
    falsePositiveCount: Math.round(rate * 11),
    falsePositiveRate: rate,
    kDefault: 5
  }
}

function fakeReport(level: {
  r1: number
  r5: number
  mrr: number
  ndcg: number
  negFp: number
}): RetrievalAblationReport {
  const hit = fakeAgg({
    recallAt1: level.r1,
    recallAt5: level.r5,
    mrr: level.mrr,
    ndcgAt5: level.ndcg
  })
  const neg = fakeNeg(level.negFp)
  const view = {
    mode: 'include' as const,
    hitCaseCount: 11,
    negativeCaseCount: 11,
    ambiguousCaseCount: 0,
    pendingReviewCaseCount: 0,
    aggregateHitCases: { keyword: hit, semantic: hit, hybrid: hit },
    aggregateNegative: { keyword: neg, semantic: neg, hybrid: neg }
  }
  return {
    meta: {
      nowMs: 1,
      corpusFingerprint: 'x',
      caseCount: 22,
      hitCaseCount: 11,
      negativeCaseCount: 11,
      ambiguousLabelCaseCount: 0,
      scenarioCoverage: {},
      strategies: ['keyword', 'semantic', 'hybrid'],
      embedModel: '@cf/baai/bge-m3',
      embedTelemetry: null,
      missPolicy: 'include_miss_as_zero',
      ambiguousInDenominator: 'include',
      hybridVsProduction: {
        outcomePairs: 'excluded',
        sameDomainBoost: 'excluded',
        candidateTruncation: 'aligned_constants',
        timeSoftReopenOnEmptyCorroboration: 'excluded',
        keywordFallbackWhenEmpty: 'excluded',
        llmFramingPolish: 'excluded',
        understanding: 'frozen_goldParsed',
        excludeHardFilter: 'aligned_filterMatchesByExcludeContentTerms',
        noteZh: 'test'
      },
      knownDeltasZh: []
    },
    cases: [],
    aggregateHitCases: view.aggregateHitCases,
    aggregateNegative: view.aggregateNegative,
    denominatorViews: {
      include: view,
      clearOnly: { ...view, mode: 'clear_only' }
    },
    negativeCaseDetails: []
  }
}

describe('compare-retrieval-ablation-baseline', () => {
  const baselineLevel = { r1: 0.8, r5: 1, mrr: 0.85, ndcg: 0.9, negFp: 0.18 }

  it('从外包 JSON 抽出 report', () => {
    const wrapped = { report: fakeReport(baselineLevel), generatedAt: 'x' }
    const report = extractRetrievalAblationReport(wrapped)
    const metrics = extractAblationGatedMetrics(report)
    expect(metrics['hybrid.recallAt5']).toBe(1)
    expect(metrics['hybrid.negFpRate']).toBe(0.18)
  })

  it('与基线持平 → PASS', () => {
    const baseline = fakeReport(baselineLevel)
    const current = fakeReport(baselineLevel)
    const result = compareRetrievalAblationToBaseline({ current, baseline })
    expect(result.passed).toBe(true)
    expect(result.degraded).toEqual([])
  })

  it('hybrid Recall@5 下降 → FAIL', () => {
    const baseline = fakeReport(baselineLevel)
    const current = fakeReport({ ...baselineLevel, r5: 0.9 })
    const result = compareRetrievalAblationToBaseline({ current, baseline })
    expect(result.passed).toBe(false)
    expect(result.degraded.some(item => item.id === 'hybrid.recallAt5')).toBe(true)
    expect(formatRetrievalAblationBaselineCompareSummary(result)).toContain('FAIL')
  })

  it('negFP 上升 → FAIL；召回上升 → improved', () => {
    const baseline = fakeReport(baselineLevel)
    const current = fakeReport({ ...baselineLevel, r1: 0.9, negFp: 0.3 })
    const result = compareRetrievalAblationToBaseline({ current, baseline })
    expect(result.passed).toBe(false)
    expect(result.degraded.some(item => item.id === 'hybrid.negFpRate')).toBe(true)
    expect(result.improved.some(item => item.id === 'hybrid.recallAt1')).toBe(true)
  })
})
