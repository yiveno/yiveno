/**
 * 探针运行历史：M2 新字段 round-trip（防 Zod 静默 strip）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProbeBatchReport } from '@yiveno/probe'

const storage = new Map<string, unknown>()

vi.mock('@/infrastructure/storage/chrome-storage-local', () => ({
  readChromeStorageLocal: async <T>(
    key: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }
  ): Promise<T | null> => {
    const raw = storage.get(key)
    if (raw === undefined) {
      return null
    }
    const parsed = schema.safeParse(raw)
    return parsed.success ? parsed.data : null
  },
  writeChromeStorageLocal: async (key: string, value: unknown): Promise<void> => {
    storage.set(key, value)
  },
  removeChromeStorageLocal: async (key: string): Promise<void> => {
    storage.delete(key)
  }
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

describe('probe-run-history-storage M2 fields', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('append → get 保留 clueType / cluster / negative 聚合', async () => {
    const { appendProbeRunRecord, getProbeRunRecord, parseProbeBatchReportForStorage } =
      await import('@/dev/probe/probe-run-history-storage')

    const report: ProbeBatchReport = {
      recipeId: 'm2-roundtrip',
      fillerSeed: 42,
      startedAtIso: '2026-11-05T00:00:00.000Z',
      finishedAtIso: '2026-11-05T00:01:00.000Z',
      cases: [
        {
          caseId: 'c1',
          clue: 'ambiguous about subject',
          clueType: 'ambiguous',
          expectedKey: 'clu-bm-dev-0-0',
          expectedId: 'id-pref',
          expectedIds: ['id-pref', 'id-2'],
          preferredId: 'id-pref',
          clusterId: 'clu-bm-dev-0',
          persona: 'developer',
          source: 'cluster',
          kind: 'bookmark',
          label: 'cluster set',
          verdict: 'in_topk',
          actualTop1Title: 'other',
          latencyMs: 12
        },
        {
          caseId: 'n1',
          clue: 'veterinary dentistry yearbook',
          clueType: 'associative',
          expectedKey: '',
          expectedId: null,
          persona: 'developer',
          source: 'negative',
          kind: 'negative',
          label: 'neg',
          verdict: 'rejected',
          actualTop1Title: null,
          latencyMs: 8
        }
      ],
      aggregates: {
        total: 2,
        judged: 1,
        top1Count: 0,
        inTopkCount: 1,
        missCount: 0,
        unmappedCount: 0,
        errorCount: 0,
        top1Rate: 0,
        inTop3Rate: 1,
        missRate: 0,
        byPersona: {
          developer: {
            total: 2,
            top1: 0,
            in_topk: 1,
            miss: 0,
            unmapped: 0,
            error: 0,
            false_positive: 0,
            rejected: 1
          }
        },
        bySource: {
          cluster: {
            total: 1,
            top1: 0,
            in_topk: 1,
            miss: 0,
            unmapped: 0,
            error: 0,
            false_positive: 0,
            rejected: 0
          },
          negative: {
            total: 1,
            top1: 0,
            in_topk: 0,
            miss: 0,
            unmapped: 0,
            error: 0,
            false_positive: 0,
            rejected: 1
          }
        },
        byClueType: {
          ambiguous: {
            total: 1,
            top1: 0,
            in_topk: 1,
            miss: 0,
            unmapped: 0,
            error: 0,
            false_positive: 0,
            rejected: 0
          },
          associative: {
            total: 1,
            top1: 0,
            in_topk: 0,
            miss: 0,
            unmapped: 0,
            error: 0,
            false_positive: 0,
            rejected: 1
          }
        },
        clusters: {
          total: 1,
          anyHitCount: 1,
          preferredTop1Count: 0,
          anyHitRate: 1,
          preferredTop1Rate: 0
        },
        negatives: {
          total: 1,
          falsePositiveCount: 0,
          rejectedCount: 1,
          falsePositiveRate: 0
        },
        latencyMs: { p50: 10, p95: 12 }
      }
    }

    const parsed = parseProbeBatchReportForStorage(report)
    expect(parsed.aggregates.clusters?.anyHitRate).toBe(1)
    expect(parsed.cases[0]?.clueType).toBe('ambiguous')

    const written = await appendProbeRunRecord(report)
    const read = await getProbeRunRecord(written.runId)
    expect(read).not.toBeNull()
    expect(read!.report.cases[0]?.clueType).toBe('ambiguous')
    expect(read!.report.cases[0]?.clusterId).toBe('clu-bm-dev-0')
    expect(read!.report.cases[0]?.expectedIds).toEqual(['id-pref', 'id-2'])
    expect(read!.report.cases[1]?.verdict).toBe('rejected')
    expect(read!.report.aggregates.byClueType?.ambiguous?.in_topk).toBe(1)
    expect(read!.report.aggregates.clusters?.anyHitRate).toBe(1)
    expect(read!.report.aggregates.negatives?.rejectedCount).toBe(1)
  })
})
