import { beforeEach, describe, expect, it, vi } from 'vitest'

const isChromeBookmarkSyncEnabledMock = vi.hoisted(() => vi.fn())
const readChromeBookmarkImportStateMock = vi.hoisted(() => vi.fn())
const readChromeBookmarkLeavesMock = vi.hoisted(() => vi.fn())
const listBookmarkSyncAlignmentMock = vi.hoisted(() => vi.fn())
const readChromeBookmarkDeleteTombstoneIdsMock = vi.hoisted(() => vi.fn())

vi.mock('@/application/capture/chrome-bookmark-sync-service', () => ({
  isChromeBookmarkSyncEnabled: isChromeBookmarkSyncEnabledMock
}))
vi.mock('@/application/capture/chrome-bookmark-bulk-import', () => ({
  readChromeBookmarkImportState: readChromeBookmarkImportStateMock
}))
vi.mock('@/infrastructure/browser/chrome-bookmark-reader', () => ({
  readChromeBookmarkLeaves: readChromeBookmarkLeavesMock
}))
vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    listBookmarkSyncAlignment: listBookmarkSyncAlignmentMock
  }
}))
vi.mock('@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage', () => ({
  readChromeBookmarkDeleteTombstoneIds: readChromeBookmarkDeleteTombstoneIdsMock
}))
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { countUnsyncedChromeBookmarkLeaves } from '@/application/capture/chrome-bookmark-sync-staleness'

describe('countUnsyncedChromeBookmarkLeaves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readChromeBookmarkDeleteTombstoneIdsMock.mockResolvedValue(new Set())
  })

  it('同步开 → 0', async () => {
    isChromeBookmarkSyncEnabledMock.mockResolvedValue(true)
    await expect(countUnsyncedChromeBookmarkLeaves()).resolves.toBe(0)
    expect(readChromeBookmarkLeavesMock).not.toHaveBeenCalled()
  })

  it('导入未完成 → 0', async () => {
    isChromeBookmarkSyncEnabledMock.mockResolvedValue(false)
    readChromeBookmarkImportStateMock.mockResolvedValue({ status: 'running' })
    await expect(countUnsyncedChromeBookmarkLeaves()).resolves.toBe(0)
    expect(readChromeBookmarkLeavesMock).not.toHaveBeenCalled()
  })

  it('N 条未同步 → N', async () => {
    isChromeBookmarkSyncEnabledMock.mockResolvedValue(false)
    readChromeBookmarkImportStateMock.mockResolvedValue({ status: 'completed' })
    readChromeBookmarkLeavesMock.mockResolvedValue([
      { chromeBookmarkId: '1' },
      { chromeBookmarkId: '2' },
      { chromeBookmarkId: '3' }
    ])
    listBookmarkSyncAlignmentMock.mockResolvedValue({
      byChromeBookmarkId: new Map([['1', 'mem-1']]),
      byUrl: new Map(),
      noteByMemoryId: new Map(),
      savedAtByMemoryId: new Map()
    })
    await expect(countUnsyncedChromeBookmarkLeaves()).resolves.toBe(2)
  })

  it('墓碑排除：tombstone 不计入 unsynced', async () => {
    isChromeBookmarkSyncEnabledMock.mockResolvedValue(false)
    readChromeBookmarkImportStateMock.mockResolvedValue({ status: 'completed' })
    readChromeBookmarkLeavesMock.mockResolvedValue([
      { chromeBookmarkId: 'alive' },
      { chromeBookmarkId: 'tomb' }
    ])
    listBookmarkSyncAlignmentMock.mockResolvedValue({
      byChromeBookmarkId: new Map(),
      byUrl: new Map(),
      noteByMemoryId: new Map(),
      savedAtByMemoryId: new Map()
    })
    readChromeBookmarkDeleteTombstoneIdsMock.mockResolvedValue(new Set(['tomb']))
    await expect(countUnsyncedChromeBookmarkLeaves()).resolves.toBe(1)
  })

  it('失败 → 抛错', async () => {
    isChromeBookmarkSyncEnabledMock.mockResolvedValue(false)
    readChromeBookmarkImportStateMock.mockResolvedValue({ status: 'completed' })
    readChromeBookmarkLeavesMock.mockRejectedValue(new Error('chrome_denied'))
    await expect(countUnsyncedChromeBookmarkLeaves()).rejects.toThrow('chrome_denied')
  })
})
