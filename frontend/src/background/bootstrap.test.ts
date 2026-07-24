import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureChromeBookmarksImportedMock,
  getCurrentOwnerIdMock,
  getOrCreateLocalProfileMock,
  initializeMemoryDatabaseMock,
  registerChromeBookmarkSyncListenersMock,
  registerContextMenuListenersMock,
  registerOmniboxListenersMock,
  registerCommandListenersMock
} = vi.hoisted(() => ({
  ensureChromeBookmarksImportedMock: vi.fn(async () => ({ status: 'completed' as const })),
  getCurrentOwnerIdMock: vi.fn(async () => 'owner-1'),
  getOrCreateLocalProfileMock: vi.fn(async () => ({
    localProfileId: 'profile-1',
    createdAt: '2026-07-22T05:00:00.000Z',
    schemaVersion: 1
  })),
  initializeMemoryDatabaseMock: vi.fn(async () => undefined),
  registerChromeBookmarkSyncListenersMock: vi.fn(),
  registerContextMenuListenersMock: vi.fn(),
  registerOmniboxListenersMock: vi.fn(),
  registerCommandListenersMock: vi.fn()
}))

vi.mock('@/application/capture/import-chrome-bookmarks-service', () => ({
  ensureChromeBookmarksImported: ensureChromeBookmarksImportedMock
}))

vi.mock('@/background/listeners/chrome-bookmark-sync', () => ({
  registerChromeBookmarkSyncListeners: registerChromeBookmarkSyncListenersMock
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
    expect(registerChromeBookmarkSyncListenersMock).toHaveBeenCalledTimes(1)
    expect(registerContextMenuListenersMock).toHaveBeenCalledTimes(1)
    expect(registerOmniboxListenersMock).toHaveBeenCalledTimes(1)
    expect(registerCommandListenersMock).toHaveBeenCalledTimes(1)
  })

  it('延迟启动 Chrome 书签导入', async () => {
    await ensureBackgroundBootstrapped()

    expect(ensureChromeBookmarksImportedMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)

    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
  })
})
