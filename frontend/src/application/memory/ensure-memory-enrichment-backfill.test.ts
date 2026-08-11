import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listByOwnerMock, putManyMock, readChromeStorageLocalMock, writeChromeStorageLocalMock } =
  vi.hoisted(() => ({
    listByOwnerMock: vi.fn(),
    putManyMock: vi.fn(async () => undefined),
    readChromeStorageLocalMock: vi.fn(),
    writeChromeStorageLocalMock: vi.fn(async () => undefined)
  }))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listByOwner: listByOwnerMock,
    putMany: putManyMock
  }
}))

vi.mock('@/infrastructure/storage/chrome-storage-local', () => ({
  readChromeStorageLocal: readChromeStorageLocalMock,
  writeChromeStorageLocal: writeChromeStorageLocalMock
}))

import { ensureMemoryEnrichmentBackfilled } from '@/application/memory/ensure-memory-enrichment-backfill'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { MEMORY_ENRICHMENT_BACKFILL_VERSION } from '@/core/memory/memory-enrichment-backfill'

describe('ensureMemoryEnrichmentBackfilled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('版本已达标则跳过', async () => {
    readChromeStorageLocalMock.mockResolvedValue({ version: MEMORY_ENRICHMENT_BACKFILL_VERSION })
    const result = await ensureMemoryEnrichmentBackfilled()
    expect(result.status).toBe('skipped')
    expect(listByOwnerMock).not.toHaveBeenCalled()
  })

  it('扫描并写回有变更的条目，然后标记版本', async () => {
    readChromeStorageLocalMock.mockResolvedValue(null)
    const fresh = createBookmarkMemoryItem({
      ownerId: '11111111-1111-4111-8111-111111111111',
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      now: () => '2026-07-22T06:00:00.000Z',
      payload: {
        title: 'NetEase Cloud Music',
        url: 'https://music.163.com/'
      }
    })
    const legacy = {
      ...fresh,
      clues: {
        ...fresh.clues,
        tags: [] as string[],
        keywords: [] as string[],
        entities: [] as string[]
      }
    }
    listByOwnerMock.mockResolvedValue([legacy])

    const result = await ensureMemoryEnrichmentBackfilled({
      listByOwner: listByOwnerMock,
      putMany: putManyMock
    } as never)

    expect(result.status).toBe('completed')
    expect(result.scanned).toBe(1)
    expect(result.updated).toBe(1)
    expect(putManyMock).toHaveBeenCalledTimes(1)
    expect(writeChromeStorageLocalMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ version: MEMORY_ENRICHMENT_BACKFILL_VERSION })
    )
  })
})
