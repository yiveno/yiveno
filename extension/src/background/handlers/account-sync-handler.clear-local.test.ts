import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountBindingMock,
  getOrCreateLocalProfileMock,
  listAllByOwnerIdMock,
  replaceOwnerItemsMock,
  getSyncPrefsMock,
  patchSyncPrefsMock,
  ensureMemoryCloudSyncAlarmMock,
  updateUserSettingsMock,
  syncListenersMock
} = vi.hoisted(() => ({
  getAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn(),
  getSyncPrefsMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  syncListenersMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock,
  clearAccountBinding: vi.fn(),
  setAccountBinding: vi.fn()
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listAllByOwnerId: listAllByOwnerIdMock,
    replaceOwnerItems: replaceOwnerItemsMock
  }
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: getSyncPrefsMock,
  patchSyncPrefs: patchSyncPrefsMock
}))

vi.mock('@/infrastructure/sync/memory-cloud-sync-alarm', () => ({
  ensureMemoryCloudSyncAlarm: ensureMemoryCloudSyncAlarmMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  updateUserSettings: updateUserSettingsMock,
  getUserSettings: vi.fn()
}))

vi.mock('@/background/listeners/chrome-bookmark-sync', () => ({
  syncChromeBookmarkSyncListenersWithIngestSetting: syncListenersMock
}))

import { handleClearLocalMemory } from '@/background/handlers/account-sync-handler'

describe('handleClearLocalMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAccountBindingMock.mockResolvedValue(null)
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId: 'local-1',
      createdAt: '2026-08-07T00:00:00.000Z',
      schemaVersion: 1
    })
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    replaceOwnerItemsMock.mockResolvedValue(0)
    getSyncPrefsMock.mockResolvedValue({ enabled: false })
    updateUserSettingsMock.mockResolvedValue({
      selectionToolbarEnabled: true,
      aiFeaturesEnabled: true,
      chromeBookmarkIngestEnabled: false
    })
    syncListenersMock.mockResolvedValue(undefined)
  })

  it('清除本机条目并关闭书签灌库，不依赖 Chrome bookmarks API', async () => {
    const response = await handleClearLocalMemory()
    expect(response).toEqual({
      ok: true,
      ownerId: 'local-1',
      clearedCount: 2,
      bookmarkIngestDisabled: true,
      syncDisabled: false
    })
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith('local-1', [])
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ chromeBookmarkIngestEnabled: false })
    expect(syncListenersMock).toHaveBeenCalledWith(false)
    expect(patchSyncPrefsMock).not.toHaveBeenCalled()
  })

  it('同步开着时一并关闭同步', async () => {
    getSyncPrefsMock.mockResolvedValue({ enabled: true })
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)

    const response = await handleClearLocalMemory()
    expect(response.ok).toBe(true)
    if (response.ok) {
      expect(response.syncDisabled).toBe(true)
    }
    expect(patchSyncPrefsMock).toHaveBeenCalledWith({ enabled: false })
    expect(ensureMemoryCloudSyncAlarmMock).toHaveBeenCalledWith(false)
  })
})
