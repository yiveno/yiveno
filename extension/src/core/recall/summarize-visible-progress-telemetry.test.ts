import { describe, expect, it } from 'vitest'

import type { RecallTelemetryEvent } from '@/core/recall/recall-telemetry'
import { summarizeVisibleProgressTelemetry } from '@/core/recall/summarize-visible-progress-telemetry'

const base = {
  taskId: '11111111-1111-4111-8111-111111111111',
  traceId: '11111111-1111-4111-8111-111111111111',
  at: '2026-11-01T00:00:00.000Z'
}

describe('summarizeVisibleProgressTelemetry', () => {
  it('分计放弃率与改写；有结果的 task 不算放弃', () => {
    const events: RecallTelemetryEvent[] = [
      { type: 'clue_submitted', cluePreview: 'a', ...base },
      {
        type: 'wait_abandoned',
        reason: 'panel_close',
        waitProgress: { progressRevealed: true, waitElapsedMs: 2000, peakStage: 'understanding' },
        ...base
      },
      {
        type: 'clue_submitted',
        cluePreview: 'b',
        taskId: '22222222-2222-4222-8222-222222222222',
        traceId: '22222222-2222-4222-8222-222222222222',
        at: '2026-11-01T00:01:00.000Z'
      },
      {
        type: 'clue_refined',
        cluePreview: 'b2',
        priorCluePreview: 'b',
        taskId: '22222222-2222-4222-8222-222222222222',
        traceId: '22222222-2222-4222-8222-222222222222',
        at: '2026-11-01T00:01:01.000Z'
      },
      {
        type: 'result_rendered',
        outcome: 'top_pick',
        resultCount: 2,
        waitProgress: { progressRevealed: true, waitElapsedMs: 900, peakStage: 'checking' },
        taskId: '22222222-2222-4222-8222-222222222222',
        traceId: '22222222-2222-4222-8222-222222222222',
        at: '2026-11-01T00:01:02.000Z'
      }
    ]

    const summary = summarizeVisibleProgressTelemetry(events)
    expect(summary.submittedTasks).toBe(2)
    expect(summary.abandonedBeforeResult).toBe(1)
    expect(summary.abandonRate).toBe(0.5)
    expect(summary.abandonedWhileProgressRevealed).toBe(1)
    expect(summary.completedWithResult).toBe(1)
    expect(summary.refineEvents).toBe(1)
    expect(summary.byAbandonReason.panel_close).toBe(1)
    expect(summary.resultsWithProgressRevealed).toBe(1)
  })
})
