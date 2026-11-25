import { describe, expect, it } from 'vitest'

import { compareClueChainBaseline } from '@/core/recall/eval/clue-chain/compare-baseline'
import type { ClueChainParseReport } from '@/core/recall/eval/clue-chain/types'

function minimalReport(
  head: string,
  cases: Array<{ id: string; corePassed: boolean; topicPass: boolean }>
): ClueChainParseReport {
  const topicPassed = cases.filter(c => c.topicPass).length
  const corePassed = cases.filter(c => c.corePassed).length
  const intentPassed = cases.length
  return {
    schemaVersion: 1,
    kind: 'clue-chain-parse',
    head,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:01:00.000Z',
    fixtureFiles: [],
    llm: {
      parseCompat: 'deepseek',
      parseModel: 'deepseek-chat',
      judgeModel: 'deepseek-chat',
      direct: true
    },
    summary: {
      totalCases: cases.length,
      parseOk: cases.length,
      parseFailed: 0,
      timedOut: 0,
      skipped: 0,
      core: { scored: cases.length, passed: corePassed, rate: corePassed / cases.length },
      intent: { scored: cases.length, passed: intentPassed, rate: 1 },
      topic: { scored: cases.length, passed: topicPassed, rate: topicPassed / cases.length },
      topicCategoryA: { scored: 0, passed: 0, rate: 1 },
      intentCategoryC: { scored: 0, passed: 0, rate: 1 },
      time: { scored: 0, passed: 0, rate: 1 },
      type: { scored: 0, passed: 0, rate: 1 },
      entities: { scored: 0, passed: 0, rate: 1 },
      gates: {
        intentCategoryC: true,
        topicCategoryA: true,
        topicOverall: true,
        allPassed: true
      }
    },
    clusters: [],
    worst10: [],
    cases: cases.map(c => ({
      run: {
        id: c.id,
        category: 'A',
        clue: c.id,
        note: '',
        difficulty: 'easy',
        expected: {
          intent: 'recall',
          topic: 't',
          time: null,
          time_certainty: null,
          type: null,
          entities: [],
          behavior: null,
          certainty: 'low'
        },
        parsed: null,
        source: 'llm',
        intentActual: 'recall',
        topicTermsActual: [],
        timeLabelActual: null,
        timeConfidenceActual: null,
        objectTypesActual: [],
        objectTypeOtherActual: null,
        contentTermsActual: [],
        excludeContentTermsActual: [],
        confidenceActual: 'low',
        durationMs: 1,
        attempts: 1,
        error: null,
        timedOut: false,
        skipped: false
      },
      score: {
        id: c.id,
        category: 'A',
        note: '',
        corePassed: c.corePassed,
        fields: [],
        certaintyRecord: { expected: 'low', actual: 'low' }
      },
      topicJudge: c.topicPass ? { match: true, reason: 'ok' } : { match: false, reason: 'no' }
    }))
  }
}

describe('clue-chain compare-baseline', () => {
  it('检测 newlyFailed 与 rate 下降', () => {
    const baseline = minimalReport('aaa', [
      { id: '1', corePassed: true, topicPass: true },
      { id: '2', corePassed: true, topicPass: true }
    ])
    const current = minimalReport('bbb', [
      { id: '1', corePassed: true, topicPass: true },
      { id: '2', corePassed: false, topicPass: false }
    ])
    const delta = compareClueChainBaseline(current, baseline, 'baseline.json')
    expect(delta.degraded).toBe(true)
    expect(delta.newlyFailedIds).toEqual(['2'])
    expect(delta.coreRateDelta).toBeLessThan(0)
  })

  it('全过且无新增失败 → 不 degraded', () => {
    const baseline = minimalReport('aaa', [{ id: '1', corePassed: true, topicPass: true }])
    const current = minimalReport('bbb', [
      { id: '1', corePassed: true, topicPass: true },
      { id: '2', corePassed: true, topicPass: true }
    ])
    const delta = compareClueChainBaseline(current, baseline, 'baseline.json')
    expect(delta.degraded).toBe(false)
    expect(delta.newlyPassedIds).toEqual(['2'])
  })
})
