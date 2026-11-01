import { describe, expect, it } from 'vitest'

import {
  parseRecallTelemetryEvent,
  previewRecallClue,
  RecallTelemetryEventSchema,
  scoreRecallEvidenceEcs
} from '@/core/recall/recall-telemetry'

const baseIds = {
  taskId: '11111111-1111-4111-8111-111111111111',
  traceId: '22222222-2222-4222-8222-222222222222',
  at: '2026-08-27T00:00:00.000Z'
}

describe('recall-telemetry', () => {
  it('previewRecallClue 截断长线索', () => {
    const long = 'a'.repeat(200)
    expect(previewRecallClue(long, 120).length).toBeLessThanOrEqual(120)
    expect(previewRecallClue('  hello  ')).toBe('hello')
  })

  it('TTE 七事件 + wait_abandoned schema 可解析', () => {
    const events = [
      { type: 'clue_submitted', cluePreview: 'deploy checklist', ...baseIds },
      {
        type: 'clue_refined',
        cluePreview: 'checklist',
        priorCluePreview: 'deploy',
        ...baseIds
      },
      {
        type: 'result_rendered',
        outcome: 'top_pick',
        resultCount: 3,
        pipelineTiming: {
          understandMs: 800,
          candidateLoadMs: 120,
          retrieveMs: 40,
          totalMs: 960
        },
        waitProgress: {
          progressRevealed: true,
          waitElapsedMs: 1200,
          peakStage: 'checking',
          understandingTier: 1
        },
        ...baseIds
      },
      {
        type: 'evidence_visible',
        memoryItemId: '33333333-3333-4333-8333-333333333333',
        rank: 0,
        ecs: 5,
        reasonCodes: ['note'],
        anchor: 'release checklist excerpt',
        ...baseIds
      },
      {
        type: 'source_opened',
        memoryItemId: '33333333-3333-4333-8333-333333333333',
        rank: 0,
        ...baseIds
      },
      {
        type: 'user_confirmed',
        label: 'target',
        confidence: 'strong',
        source: 'exit_prompt',
        memoryItemId: '33333333-3333-4333-8333-333333333333',
        ...baseIds
      },
      { type: 'task_timeout', timeoutMs: 180_000, ...baseIds },
      {
        type: 'wait_abandoned',
        reason: 'panel_close',
        waitProgress: {
          progressRevealed: true,
          waitElapsedMs: 2500,
          peakStage: 'understanding',
          understandingTier: 2
        },
        ...baseIds
      }
    ] as const

    for (const event of events) {
      expect(() => parseRecallTelemetryEvent(event)).not.toThrow()
      expect(RecallTelemetryEventSchema.safeParse(event).success).toBe(true)
    }
  })

  it('scoreRecallEvidenceEcs 按 TTE checklist 递增', () => {
    const base = {
      typeLabel: 'Excerpt',
      subtitle: 'Example · example.com',
      title: '',
      url: ''
    }
    expect(scoreRecallEvidenceEcs(base)).toBe(1)

    expect(
      scoreRecallEvidenceEcs({
        ...base,
        url: 'https://example.com/page'
      })
    ).toBe(2)

    expect(
      scoreRecallEvidenceEcs({
        ...base,
        url: 'https://example.com/page',
        excerpt: 'release checklist notes'
      })
    ).toBe(3)

    expect(
      scoreRecallEvidenceEcs({
        ...base,
        url: 'https://example.com/page',
        excerpt: 'release checklist notes',
        savedAtIso: '2026-08-01T12:00:00.000Z'
      })
    ).toBe(4)

    expect(
      scoreRecallEvidenceEcs({
        ...base,
        url: 'https://example.com/page',
        excerpt: 'release checklist notes',
        savedAtIso: '2026-08-01T12:00:00.000Z',
        reasonLine: 'Matched in your note: checklist'
      })
    ).toBe(5)
  })
})
