import { describe, expect, test } from 'bun:test'

import { buildAiGateRejectedLogFields } from './ai-gate-log'

describe('buildAiGateRejectedLogFields', () => {
  test('组装 event/taskKind/reason', () => {
    expect(buildAiGateRejectedLogFields('gs_samples', 'parse_failed')).toEqual({
      event: 'ai_gate_rejected',
      taskKind: 'gs_samples',
      reason: 'parse_failed'
    })
    expect(buildAiGateRejectedLogFields('enrichment', 'validation_failed').reason).toBe(
      'validation_failed'
    )
    expect(buildAiGateRejectedLogFields('dreaming', 'quote_dropped').event).toBe('ai_gate_rejected')
    expect(buildAiGateRejectedLogFields('extract', 'parse_failed').taskKind).toBe('extract')
  })
})
