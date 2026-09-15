import { describe, expect, it } from 'vitest'

import {
  getColdStartOverallPercent,
  shouldShowColdStartGate,
  shouldShowColdStartPostReleaseBanner,
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

describe('shouldShowColdStartPostReleaseBanner', () => {
  const readyAt = '2026-09-11T12:00:00.000Z'
  const readyMs = Date.parse(readyAt)

  it('门禁未放行 / 无 readyAt → 不展示', () => {
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({ status: 'running', stage: 'ai', aiLlmEnqueued: 3 }),
        nowMs: readyMs
      })
    ).toBe(false)
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          releaseReason: 'local_ready',
          aiLlmEnqueued: 3
        }),
        nowMs: readyMs
      })
    ).toBe(false)
  })

  it('local_ready 且有 LLM 入队、TTL 内 → 展示', () => {
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'local_ready',
          aiLlmEnqueued: 5
        }),
        nowMs: readyMs + 60_000
      })
    ).toBe(true)
  })

  it('ai_best_effort_timeout 即使 enqueued=0 → 展示', () => {
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'ai_best_effort_timeout',
          aiLlmEnqueued: 0
        }),
        nowMs: readyMs + 30_000
      })
    ).toBe(true)
  })

  it('migrated_existing / TTL 过期 / 已 dismiss → 不展示', () => {
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'migrated_existing',
          aiLlmEnqueued: 10
        }),
        nowMs: readyMs + 1_000
      })
    ).toBe(false)

    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'local_ready',
          aiLlmEnqueued: 5
        }),
        nowMs: readyMs + 6 * 60_000
      })
    ).toBe(false)

    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'local_ready',
          aiLlmEnqueued: 5
        }),
        nowMs: readyMs + 1_000,
        dismissedReadyAt: readyAt
      })
    ).toBe(false)
  })

  it('有 running 批次时即使超过 TTL 仍展示', () => {
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'local_ready',
          aiLlmEnqueued: 5
        }),
        nowMs: readyMs + 10 * 60_000,
        enrichmentBatch: {
          batchId: 'b1',
          total: 5,
          settled: 2,
          status: 'running',
          updatedAt: readyAt
        }
      })
    ).toBe(true)
  })

  it('批次 completed 后不再展示', () => {
    expect(
      shouldShowColdStartPostReleaseBanner({
        state: base({
          status: 'ready',
          stage: 'done',
          readyAt,
          releaseReason: 'local_ready',
          aiLlmEnqueued: 5
        }),
        nowMs: readyMs + 1_000,
        enrichmentBatch: {
          batchId: 'b1',
          total: 5,
          settled: 5,
          status: 'completed',
          updatedAt: readyAt
        }
      })
    ).toBe(false)
  })
})
