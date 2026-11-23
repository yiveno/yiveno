import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/application/memory/schedule-async-memory-embedding', () => ({
  backfillMissingMemoryEmbeddings: vi.fn(async () => ({
    attempted: 1,
    written: 1,
    failed: 0,
    scanned: 1,
    quotaHit: false,
    workerQuotaHit: false
  })),
  enqueueMissingMemoryEmbeddings: vi.fn(async () => ({ enqueued: 0, scanned: 0 })),
  clearWorkerQuotaEmbedPause: vi.fn(),
  EMBEDDING_BACKFILL_BATCH_LIMIT: 40
}))

vi.mock('@/infrastructure/ai/hosted-quota-api-client', () => ({
  fetchHostedQuota: vi.fn(async () => ({
    model: 'm',
    tier: 'anonymous',
    used: 0,
    limit: 15,
    remaining: 15,
    dailyUsed: 0,
    dailyLimit: 15,
    dailyRemaining: 15,
    monthKey: 'lifetime',
    embedRemaining: 30
  }))
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => 'token')
}))

import {
  resetSilentMemoryEmbeddingMaintenanceForTests,
  runSilentMemoryEmbeddingMaintenance,
  scheduleSilentMemoryEmbeddingMaintenance
} from '@/application/memory/ensure-memory-embedding-maintenance'
import {
  backfillMissingMemoryEmbeddings,
  enqueueMissingMemoryEmbeddings
} from '@/application/memory/schedule-async-memory-embedding'

describe('ensure-memory-embedding-maintenance', () => {
  afterEach(() => {
    resetSilentMemoryEmbeddingMaintenanceForTests()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('runSilent：先同步回填摘录再异步入队', async () => {
    await runSilentMemoryEmbeddingMaintenance('test')
    expect(backfillMissingMemoryEmbeddings).toHaveBeenCalledTimes(1)
    expect(enqueueMissingMemoryEmbeddings).toHaveBeenCalledTimes(1)
  })

  it('scheduleSilent：防抖后执行一次', async () => {
    vi.useFakeTimers()
    scheduleSilentMemoryEmbeddingMaintenance('a', 100)
    scheduleSilentMemoryEmbeddingMaintenance('b', 100)
    await vi.advanceTimersByTimeAsync(100)
    // 合并为一次 run
    expect(backfillMissingMemoryEmbeddings).toHaveBeenCalledTimes(1)
  })
})
