import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureChromeBookmarksImportedMock,
  ensureMemoryEnrichmentBackfilledMock,
  getCurrentOwnerIdMock,
  getOrCreateLocalProfileMock,
  initializeMemoryDatabaseMock,
  syncChromeBookmarkSyncListenersWithIngestSettingMock,
  registerContextMenuListenersMock,
  registerOmniboxListenersMock,
  registerCommandListenersMock,
  registerSelectionToolbarKeepaliveListenerMock
} = vi.hoisted(() => ({
  ensureChromeBookmarksImportedMock: vi.fn(async () => ({ status: 'completed' as const })),
  ensureMemoryEnrichmentBackfilledMock: vi.fn(async () => ({
    status: 'skipped' as const,
    scanned: 0,
    updated: 0,
    version: 1
  })),
  getCurrentOwnerIdMock: vi.fn(async () => 'owner-1'),
  getOrCreateLocalProfileMock: vi.fn(async () => ({
    localProfileId: 'profile-1',
    createdAt: '2026-07-22T05:00:00.000Z',
    schemaVersion: 1
  })),
  initializeMemoryDatabaseMock: vi.fn(async () => undefined),
  syncChromeBookmarkSyncListenersWithIngestSettingMock: vi.fn(async () => undefined),
  registerContextMenuListenersMock: vi.fn(),
  registerOmniboxListenersMock: vi.fn(),
  registerCommandListenersMock: vi.fn(),
  registerSelectionToolbarKeepaliveListenerMock: vi.fn()
}))

vi.mock('@/application/capture/import-chrome-bookmarks-service', () => ({
  ensureChromeBookmarksImported: ensureChromeBookmarksImportedMock
}))

vi.mock('@/application/memory/ensure-memory-enrichment-backfill', () => ({
  ensureMemoryEnrichmentBackfilled: ensureMemoryEnrichmentBackfilledMock
}))

vi.mock('@/background/listeners/chrome-bookmark-sync', () => ({
  syncChromeBookmarkSyncListenersWithIngestSetting:
    syncChromeBookmarkSyncListenersWithIngestSettingMock
}))

vi.mock('@/background/listeners/context-menu', () => ({
  registerContextMenuListeners: registerContextMenuListenersMock
}))

vi.mock('@/background/listeners/omnibox', () => ({
  registerOmniboxListeners: registerOmniboxListenersMock
}))

vi.mock('@/background/listeners/commands', () => ({
  registerCommandListeners: registerCommandListenersMock
}))

vi.mock('@/background/listeners/selection-toolbar-keepalive', () => ({
  registerSelectionToolbarKeepaliveListener: registerSelectionToolbarKeepaliveListenerMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: getCurrentOwnerIdMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-db', () => ({
  initializeMemoryDatabase: initializeMemoryDatabaseMock
}))

import {
  ensureBackgroundBootstrapped,
  resetBackgroundBootstrapForTests
} from '@/background/bootstrap'

describe('ensureBackgroundBootstrapped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    resetBackgroundBootstrapForTests()
  })

  it('并发调用只 bootstrap 一次', async () => {
    await Promise.all([ensureBackgroundBootstrapped(), ensureBackgroundBootstrapped()])

    expect(initializeMemoryDatabaseMock).toHaveBeenCalledTimes(1)
    expect(syncChromeBookmarkSyncListenersWithIngestSettingMock).toHaveBeenCalledTimes(1)
    expect(registerContextMenuListenersMock).toHaveBeenCalledTimes(1)
    expect(registerOmniboxListenersMock).toHaveBeenCalledTimes(1)
    expect(registerCommandListenersMock).toHaveBeenCalledTimes(1)
    expect(registerSelectionToolbarKeepaliveListenerMock).toHaveBeenCalledTimes(1)
  })

  it('延迟启动 Chrome 书签导入', async () => {
    await ensureBackgroundBootstrapped()

    expect(ensureChromeBookmarksImportedMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)

    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
  })

  it('延迟启动存量 enrichment 回填', async () => {
    await ensureBackgroundBootstrapped()

    expect(ensureMemoryEnrichmentBackfilledMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1500)

    expect(ensureMemoryEnrichmentBackfilledMock).toHaveBeenCalledTimes(1)
  })
})
