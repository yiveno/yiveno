import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/application/memory/schedule-async-memory-embedding', () => ({
  backfillMissingMemoryEmbeddings: vi.fn(async () => ({
    attempted: 1,
    written: 1,
    failed: 0,
    scanned: 1,
    quotaHit: false
  })),
  enqueueMissingMemoryEmbeddings: vi.fn(async () => ({ enqueued: 0, scanned: 0 }))
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
