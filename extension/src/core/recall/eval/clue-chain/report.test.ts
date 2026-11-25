import { describe, expect, it } from 'vitest'

import {
  aggregateClueChainSummary,
  clusterClueChainFailures,
  pickWorstClueChainCases
} from '@/core/recall/eval/clue-chain/report'
import type { ClueChainCaseScore, ClueChainParseRunCase } from '@/core/recall/eval/clue-chain/types'

function row(
  id: string,
  category: 'A' | 'B' | 'C' | 'D',
  corePassed: boolean,
  failed: string[],
  note = 'n'
): { run: ClueChainParseRunCase; score: ClueChainCaseScore } {
  const fields = ['intent', 'topic', 'time', 'type', 'entities'].map(field => {
    if (category === 'C' && field !== 'intent') {
      return { field, scored: false as const, reason: 'C' }
    }
    const passed = !failed.includes(field)
    return {
      field,
      scored: true as const,
      passed,
      detail: passed ? 'ok' : `fail ${field}`
    }
  })
  return {
    run: {
      id,
      category,
      clue: id,
      note,
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
      id,
      category,
      note,
      corePassed,
      fields,
      certaintyRecord: { expected: 'low', actual: 'low' }
    }
  }
}

describe('clue-chain report', () => {
  it('汇总门禁：C intent / A topic / 整体 topic', () => {
    const rows = [
      row('A1', 'A', true, []),
      row('A2', 'A', false, ['topic']),
      row('C1', 'C', true, []),
      row('B1', 'B', true, [])
    ]
    // 修 A2 topic 字段：core 失败但 intent 过
    const summary = aggregateClueChainSummary(rows)
    expect(summary.intentCategoryC.rate).toBe(1)
    expect(summary.topicCategoryA.passed).toBe(1)
    expect(summary.topicCategoryA.scored).toBe(2)
    expect(summary.gates.intentCategoryC).toBe(true)
    expect(summary.gates.topicCategoryA).toBe(false) // 50% < 90%
  })

  it('失败按 category+note 聚类', () => {
    const rows = [
      row('1', 'A', false, ['topic'], '同一机制'),
      row('2', 'A', false, ['topic'], '同一机制'),
      row('3', 'B', false, ['intent'], '个例')
    ]
    const clusters = clusterClueChainFailures(rows)
    expect(clusters[0]?.count).toBe(2)
    expect(clusters[0]?.ids).toEqual(['1', '2'])
  })

  it('最差 10 条按失败字段数排序', () => {
    const rows = [
      row('a', 'A', false, ['topic']),
      row('b', 'A', false, ['intent', 'topic', 'time']),
      row('c', 'A', true, [])
    ]
    const worst = pickWorstClueChainCases(rows, 10)
    expect(worst[0]?.id).toBe('b')
    expect(worst).toHaveLength(2)
  })
})
