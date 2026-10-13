/**
 * 暗线基建脚手架单测：归因 / 适应登记 / 匿名草图。
 */

import { describe, expect, it } from 'vitest'

import type { RecallTelemetryEvent } from '@/core/recall/recall-telemetry'
import {
  RECALL_ADAPTATION_CONFIG,
  RECALL_ADAPTATION_CONFIG_VERSION,
  assessKnownGoldRecallGap,
  attributionDraftFromGoldGap,
  buildDualThreadAggregateSketch,
  listOmniboxForbiddenAdaptationKnobIds,
  parseRecallFailureAttribution,
  suggestFailureStageFromDetailCodes
} from '@/core/recall/dual-thread'
import { getAdaptationKnob } from '@/core/recall/dual-thread/recall-adaptation-config'

describe('dual-thread failure attribution', () => {
  it('细码 miss_neighborhood → 建议 candidate_miss', () => {
    expect(suggestFailureStageFromDetailCodes(['miss_neighborhood'])).toBe('candidate_miss')
  })

  it('parse 归一化归因', () => {
    const parsed = parseRecallFailureAttribution({
      stage: 'rank_wrong',
      detailCodes: ['hybrid_drift'],
      confidence: 'high',
      goldInNeighborhood: true
    })
    expect(parsed.stage).toBe('rank_wrong')
    expect(parsed.detailCodes).toEqual(['hybrid_drift'])
  })
})

describe('assessKnownGoldRecallGap', () => {
  const goldId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

  it('未入库 → not_captured', () => {
    const gap = assessKnownGoldRecallGap({
      goldId,
      goldInLibrary: false,
      neighborhoodIds: []
    })
    expect(gap.stage).toBe('not_captured')
    expect(attributionDraftFromGoldGap(gap).goldInLibrary).toBe(false)
  })

  it('库有未进候选 → candidate_miss', () => {
    const gap = assessKnownGoldRecallGap({
      goldId,
      goldInLibrary: true,
      candidateIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      neighborhoodIds: []
    })
    expect(gap.stage).toBe('candidate_miss')
    expect(gap.inCandidates).toBe(false)
  })

  it('邻域首屏外 → rank_wrong', () => {
    const others = Array.from({ length: 6 }, (_, i) => `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${i}`)
    const gap = assessKnownGoldRecallGap({
      goldId,
      goldInLibrary: true,
      candidateIds: [...others, goldId],
      neighborhoodIds: [...others, goldId],
      firstScreenSize: 5
    })
    expect(gap.stage).toBe('rank_wrong')
    expect(gap.inFirstScreen).toBe(false)
    expect(gap.rank).toBe(6)
  })

  it('首屏命中 → unknown（非召回漏）', () => {
    const gap = assessKnownGoldRecallGap({
      goldId,
      goldInLibrary: true,
      candidateIds: [goldId],
      neighborhoodIds: [goldId]
    })
    expect(gap.stage).toBe('unknown')
    expect(gap.inFirstScreen).toBe(true)
  })
})

describe('dual-thread adaptation config', () => {
  it('版本与旋钮表可解析且含 Omnibox 禁区', () => {
    expect(RECALL_ADAPTATION_CONFIG.version).toBe(RECALL_ADAPTATION_CONFIG_VERSION)
    expect(RECALL_ADAPTATION_CONFIG.knobs.length).toBeGreaterThanOrEqual(3)
    const forbidden = listOmniboxForbiddenAdaptationKnobIds()
    expect(forbidden).toContain('outcome_pair_soft_adjust')
    expect(forbidden).toContain('hybrid_fusion')
    expect(getAdaptationKnob('hybrid_fusion')?.omniboxForbidden).toBe(true)
    expect(getAdaptationKnob('not_a_real_knob')).toBeNull()
  })
})

describe('dual-thread aggregate sketch', () => {
  it('剥离私人字段并统计 outcome', () => {
    const taskId = '11111111-1111-4111-8111-111111111111'
    const traceId = '22222222-2222-4222-8222-222222222222'
    const events: RecallTelemetryEvent[] = [
      {
        type: 'result_rendered',
        taskId,
        traceId,
        at: '2026-10-10T00:00:00.000Z',
        outcome: 'top_pick',
        resultCount: 3,
        pipelineTiming: {
          understandMs: 10,
          candidateLoadMs: 20,
          retrieveMs: 30,
          totalMs: 100
        }
      },
      {
        type: 'user_confirmed',
        taskId,
        traceId,
        at: '2026-10-10T00:00:01.000Z',
        label: 'target',
        source: 'exit_prompt'
      }
    ]

    const sketch = buildDualThreadAggregateSketch({
      events,
      attributions: [
        { stage: 'candidate_miss', detailCodes: ['miss_neighborhood'], confidence: 'medium' }
      ],
      nowIso: '2026-10-10T12:00:00.000Z'
    })

    expect(sketch.telemetryEventCount).toBe(2)
    expect(sketch.resultOutcomeCounts.top_pick).toBe(1)
    expect(sketch.confirmLabelCounts.target).toBe(1)
    expect(sketch.failureStageCounts.candidate_miss).toBe(1)
    expect(sketch.timingTotalMs?.p50).toBe(100)
    expect(sketch).not.toHaveProperty('cluePreview')
    expect(JSON.stringify(sketch)).not.toMatch(/https?:\/\//i)
    expect(Object.keys(sketch).join(',')).not.toMatch(/memoryItemId|cluePreview/)
  })
})
