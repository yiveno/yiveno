import { describe, expect, it } from 'vitest'

import {
  getColdStartOverallPercent,
  shouldShowColdStartGate,
  type ColdStartPipelineState
} from '@/core/memory/cold-start-pipeline-state'

function base(partial: Partial<ColdStartPipelineState>): ColdStartPipelineState {
  return {
    version: 1,
    status: 'running',
    stage: 'idle',
    importImportedCount: 0,
    rulesScanned: 0,
    rulesUpdated: 0,
    aiEmbedAttempted: 0,
    aiEmbedWritten: 0,
    aiLlmEnqueued: 0,
    ...partial
  }
}

describe('cold-start-pipeline-state', () => {
  it('ready / pending 门禁可见性', () => {
    expect(shouldShowColdStartGate(null)).toBe(false)
    expect(shouldShowColdStartGate(base({ status: 'pending' }))).toBe(true)
    expect(shouldShowColdStartGate(base({ status: 'running' }))).toBe(true)
    expect(shouldShowColdStartGate(base({ status: 'ready', stage: 'done' }))).toBe(false)
  })

  it('综合进度按阶段加权', () => {
    expect(getColdStartOverallPercent(base({ status: 'ready', stage: 'done' }))).toBe(100)
    expect(
      getColdStartOverallPercent(
        base({
          stage: 'import',
          importImportedCount: 50,
          importTotalCount: 100
        })
      )
    ).toBe(20)
    expect(getColdStartOverallPercent(base({ stage: 'rules', rulesScanned: 10 }))).toBe(55)
    expect(
      getColdStartOverallPercent(
        base({
          stage: 'ai',
          aiEmbedAttempted: 10,
          aiEmbedWritten: 5
        })
      )
    ).toBe(83)
  })
})
