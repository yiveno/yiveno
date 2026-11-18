import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getOrCreateLocalProfileMock,
  getAccountBindingMock,
  listOwnerBucketSummariesMock,
  listAllByOwnerIdMock,
  replaceOwnerItemsMock,
  resetChromeBookmarkImportAfterLocalClearMock,
  invalidateBookmarkSyncAlignmentCacheMock
} = vi.hoisted(() => ({
  getOrCreateLocalProfileMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  listOwnerBucketSummariesMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn(),
  resetChromeBookmarkImportAfterLocalClearMock: vi.fn(),
  invalidateBookmarkSyncAlignmentCacheMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getOrCreateLocalProfile: getOrCreateLocalProfileMock,
  getAccountBinding: getAccountBindingMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listOwnerBucketSummaries: listOwnerBucketSummariesMock,
    listAllByOwnerId: listAllByOwnerIdMock,
    replaceOwnerItems: replaceOwnerItemsMock
  }
}))

vi.mock('@/application/capture/import-chrome-bookmarks-service', () => ({
  resetChromeBookmarkImportAfterLocalClear: resetChromeBookmarkImportAfterLocalClearMock
}))

vi.mock('@/application/memory/bookmark-sync-alignment-cache', () => ({
  invalidateBookmarkSyncAlignmentCache: invalidateBookmarkSyncAlignmentCacheMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import {
  clearOrphanOwnerBuckets,
  exportOrphanOwnerBuckets,
  summarizeOrphanOwnerBuckets
} from '@/application/identity/orphan-owner-buckets'

const localProfileId = '11111111-1111-4111-8111-111111111111'
const accountId = '22222222-2222-4222-8222-222222222222'
const orphanId = '33333333-3333-4333-8333-333333333333'

describe('orphan-owner-buckets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
    getAccountBindingMock.mockResolvedValue({
      accountId,
      boundAt: '2026-08-01T00:00:00.000Z'
    })
  })

  it('盘点时排除当前账号与 localProfile', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: localProfileId, activeCount: 1, totalCount: 1 },
      { ownerId: accountId, activeCount: 2, totalCount: 2 },
      { ownerId: orphanId, activeCount: 4, totalCount: 5 }
    ])

    const summary = await summarizeOrphanOwnerBuckets()
    expect(summary).toEqual({
      orphanBucketCount: 1,
      orphanActiveCount: 4,
      orphanTotalCount: 5,
      orphanOwnerIds: [orphanId]
    })
  })

  it('未登录时仅保留 localProfile，历史账号计为孤儿', async () => {
    getAccountBindingMock.mockResolvedValue(null)
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: localProfileId, activeCount: 0, totalCount: 0 },
      { ownerId: accountId, activeCount: 3, totalCount: 3 }
    ])

    const summary = await summarizeOrphanOwnerBuckets()
    expect(summary.orphanBucketCount).toBe(1)
    expect(summary.orphanOwnerIds).toEqual([accountId])
    expect(summary.orphanActiveCount).toBe(3)
  })

  it('导出只拉孤儿桶条目', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: accountId, activeCount: 1, totalCount: 1 },
      { ownerId: orphanId, activeCount: 1, totalCount: 1 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'o1', ownerId: orphanId }])

    const items = await exportOrphanOwnerBuckets()
    expect(listAllByOwnerIdMock).toHaveBeenCalledWith(orphanId, { includeDeleted: true })
    expect(items).toEqual([{ id: 'o1', ownerId: orphanId }])
  })

  it('清除只删孤儿桶、不动保留集', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: accountId, activeCount: 2, totalCount: 2 },
      { ownerId: orphanId, activeCount: 1, totalCount: 2 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'a', type: 'text_excerpt' },
      { id: 'b', type: 'text_excerpt' }
    ])
    replaceOwnerItemsMock.mockResolvedValue(0)

    const result = await clearOrphanOwnerBuckets()
    expect(result).toEqual({ clearedBuckets: 1, clearedItems: 2 })
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(orphanId, [])
    expect(replaceOwnerItemsMock).not.toHaveBeenCalledWith(accountId, [])
    expect(invalidateBookmarkSyncAlignmentCacheMock).toHaveBeenCalledOnce()
    expect(resetChromeBookmarkImportAfterLocalClearMock).not.toHaveBeenCalled()
  })

  it('孤儿桶含书签行 → 清空后重置导入状态并失效对齐缓存', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: orphanId, activeCount: 1, totalCount: 1 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'bm', type: 'bookmark' }])
    replaceOwnerItemsMock.mockResolvedValue(0)
    resetChromeBookmarkImportAfterLocalClearMock.mockResolvedValue(undefined)

    const result = await clearOrphanOwnerBuckets()
    expect(result.clearedItems).toBe(1)
    expect(invalidateBookmarkSyncAlignmentCacheMock).toHaveBeenCalledOnce()
    expect(resetChromeBookmarkImportAfterLocalClearMock).toHaveBeenCalledOnce()
  })

  it('孤儿桶仅摘录 → 失效对齐缓存但不重置导入状态', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: orphanId, activeCount: 2, totalCount: 2 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt' },
      { id: 'e2', type: 'text_excerpt' }
    ])
    replaceOwnerItemsMock.mockResolvedValue(0)

    await clearOrphanOwnerBuckets()
    expect(invalidateBookmarkSyncAlignmentCacheMock).toHaveBeenCalledOnce()
    expect(resetChromeBookmarkImportAfterLocalClearMock).not.toHaveBeenCalled()
  })
})
