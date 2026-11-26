/**
 * 冷启动库探测签名：轮询去重用指纹。
 */
import { describe, expect, it } from 'vitest'
import type { ColdStartEnrichmentBatch } from '@/core/memory/cold-start-enrichment-batch'
import type { ColdStartPipelineState } from '@/core/memory/cold-start-pipeline-state'
import { coldStartProbeSignature } from './use-sidepanel-cold-start'

function readyState(partial?: Partial<ColdStartPipelineState>): ColdStartPipelineState {
  return {
    version: 1,
    status: 'ready',
    stage: 'idle',
    importImportedCount: 0,
    rulesScanned: 0,
    rulesUpdated: 0,
    aiEmbedAttempted: 0,
    aiEmbedWritten: 0,
    aiLlmEnqueued: 0,
    readyAt: '2026-11-27T00:00:00.000Z',
    ...partial
  }
}

function runningBatch(partial?: Partial<ColdStartEnrichmentBatch>): ColdStartEnrichmentBatch {
  return {
    batchId: 'batch-1',
    total: 40,
    settled: 10,
    status: 'running',
    updatedAt: '2026-11-27T00:00:00.000Z',
    ...partial
  }
}

describe('coldStartProbeSignature', () => {
  it('相同输入签名相等', () => {
    const state = readyState()
    const batch = runningBatch()
    expect(coldStartProbeSignature(state, batch)).toBe(coldStartProbeSignature(state, batch))
  })

  it('settled 变化签名不等', () => {
    const state = readyState()
    const a = coldStartProbeSignature(state, runningBatch({ settled: 10 }))
    const b = coldStartProbeSignature(state, runningBatch({ settled: 11 }))
    expect(a).not.toBe(b)
  })

  it('status ready→failed 签名不等', () => {
    const batch = runningBatch()
    const a = coldStartProbeSignature(readyState({ status: 'ready' }), batch)
    const b = coldStartProbeSignature(readyState({ status: 'failed' }), batch)
    expect(a).not.toBe(b)
  })

  it('state null 与 ready 签名不等', () => {
    const ready = coldStartProbeSignature(readyState(), null)
    expect(coldStartProbeSignature(null, null)).toBe('none')
    expect(coldStartProbeSignature(null, null)).not.toBe(ready)
  })

  it('batch null 与 batch running 签名不等', () => {
    const state = readyState()
    expect(coldStartProbeSignature(state, null)).not.toBe(
      coldStartProbeSignature(state, runningBatch())
    )
  })
})
