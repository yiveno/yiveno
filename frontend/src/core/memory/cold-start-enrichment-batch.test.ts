import { describe, expect, it } from 'vitest'

import {
  coldStartEnrichmentBatchProgressRatio,
  shouldShowColdStartEnrichmentBatchProgress,
  type ColdStartEnrichmentBatch
} from '@/core/memory/cold-start-enrichment-batch'

function batch(partial: Partial<ColdStartEnrichmentBatch>): ColdStartEnrichmentBatch {
  return {
    batchId: 'b1',
    total: 40,
    settled: 0,
    status: 'running',
    updatedAt: '2026-09-11T12:00:00.000Z',
    ...partial
  }
}

describe('cold-start-enrichment-batch', () => {
  it('进度比例与展示条件', () => {
    expect(coldStartEnrichmentBatchProgressRatio(batch({ settled: 10, total: 40 }))).toBe(0.25)
    expect(shouldShowColdStartEnrichmentBatchProgress(batch({ settled: 10 }))).toBe(true)
    expect(
      shouldShowColdStartEnrichmentBatchProgress(batch({ settled: 40, status: 'completed' }))
    ).toBe(false)
    expect(
      shouldShowColdStartEnrichmentBatchProgress(batch({ settled: 12, status: 'paused_quota' }))
    ).toBe(true)
    expect(shouldShowColdStartEnrichmentBatchProgress(null)).toBe(false)
  })
})
