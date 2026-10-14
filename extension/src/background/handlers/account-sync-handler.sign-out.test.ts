import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  clearAuthSessionMock,
  getAccountBindingMock,
  clearAccountBindingMock,
  getOrCreateLocalProfileMock,
  patchSyncPrefsMock,
  remapOwnerIdMock,
  listAllByOwnerIdMock,
  replaceOwnerItemsMock,
  replaceRemoteWithLocalItemsMock,
  getAuthSessionMock,
  setAuthSessionMock,
  setAccountBindingMock,
  refreshAuthSessionMock,
  clearSubscriptionSnapshotMock,
  ensureMemoryCloudSyncAlarmMock
} = vi.hoisted(() => ({
  clearAuthSessionMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  clearAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  remapOwnerIdMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn(),
  replaceRemoteWithLocalItemsMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  setAuthSessionMock: vi.fn(),
  setAccountBindingMock: vi.fn(),
  refreshAuthSessionMock: vi.fn(),
  clearSubscriptionSnapshotMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  clearAuthSession: clearAuthSessionMock,
  getAuthSession: getAuthSessionMock,
  setAuthSession: setAuthSessionMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  clearAccountBinding: clearAccountBindingMock,
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock,
  setAccountBinding: setAccountBindingMock
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: vi.fn(async () => ({ enabled: false })),
  patchSyncPrefs: patchSyncPrefsMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: remapOwnerIdMock,
    listAllByOwnerId: listAllByOwnerIdMock,
    replaceOwnerItems: replaceOwnerItemsMock
  }
}))

vi.mock('@/infrastructure/identity/subscription-service', () => ({
  clearSubscriptionSnapshot: clearSubscriptionSnapshotMock,
  getSubscriptionSnapshot: vi.fn(),
  refreshSubscriptionSnapshot: vi.fn()
}))

vi.mock('@/infrastructure/sync/memory-cloud-sync-alarm', () => ({
  ensureMemoryCloudSyncAlarm: ensureMemoryCloudSyncAlarmMock
}))

vi.mock('@/infrastructure/messaging/memory-sync-api-client', () => ({
  fetchRemoteSyncStatus: vi.fn(),
  pullRemoteMemoryItems: vi.fn(),
  replaceRemoteWithLocalItems: replaceRemoteWithLocalItemsMock
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: refreshAuthSessionMock
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: vi.fn(async () => undefined),
  revalidateAuthSession: vi.fn(async () => ({ status: 'skipped' }))
}))

vi.mock('@/application/identity/absorb-local-profile-into-account', () => ({
  absorbLocalProfileIntoAccount: vi.fn(async () => 0)
}))

vi.mock('@/infrastructure/browser/website-page', () => ({
  getWebsiteBaseUrl: () => 'https://yiveno.com',
  openWebsiteLoginPage: vi.fn(),
  openWebsiteLogoutFromExtension: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/auth/extension-uninstall-url', () => ({
  clearExtensionUninstallRevoke: vi.fn(async () => undefined),
  registerExtensionUninstallRevoke: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { handleAuthSignOut } from '@/background/handlers/account-sync-handler'

const accountId = '22222222-2222-4222-8222-222222222222'
const localProfileId = '11111111-1111-4111-8111-111111111111'

describe('handleAuthSignOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAccountBindingMock.mockResolvedValue({
      accountId,
      boundAt: '2026-08-01T00:00:00.000Z'
    })
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
    clearAuthSessionMock.mockResolvedValue(undefined)
    clearAccountBindingMock.mockResolvedValue(undefined)
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    remapOwnerIdMock.mockResolvedValue(0)
    listAllByOwnerIdMock.mockResolvedValue([])
    replaceOwnerItemsMock.mockResolvedValue(0)
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: accountId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    clearSubscriptionSnapshotMock.mockResolvedValue(undefined)
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)
  })

  it('keep_local 只清 session，不删 Memory', async () => {
    const result = await handleAuthSignOut('keep_local')
    expect(result).toEqual({
      ok: true,
      mode: 'keep_local',
      clearedCount: 0,
      syncedCount: 0
    })
    expect(replaceOwnerItemsMock).not.toHaveBeenCalled()
    expect(clearAuthSessionMock).toHaveBeenCalled()
    expect(clearAccountBindingMock).toHaveBeenCalled()
  })

  it('clear_local 删除当前账号桶后退出', async () => {
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    const result = await handleAuthSignOut('clear_local')
    expect(result).toMatchObject({
      ok: true,
      mode: 'clear_local',
      clearedCount: 2,
      syncedCount: 0
    })
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
    expect(remapOwnerIdMock).not.toHaveBeenCalled()
  })

  it('sync_then_clear_local 本机有摘录时覆盖云端再清', async () => {
    const items = [
      { id: 'a', ownerId: accountId, type: 'text_excerpt' },
      { id: 'b', ownerId: accountId, type: 'bookmark' }
    ]
    listAllByOwnerIdMock.mockResolvedValue(items)
    replaceRemoteWithLocalItemsMock.mockResolvedValue({ written: 1, backupId: 'bak' })

    const result = await handleAuthSignOut('sync_then_clear_local')
    expect(result).toMatchObject({
      ok: true,
      mode: 'sync_then_clear_local',
      clearedCount: 2,
      syncedCount: 1
    })
    expect(remapOwnerIdMock).toHaveBeenCalledWith(localProfileId, accountId)
    expect(replaceRemoteWithLocalItemsMock).toHaveBeenCalledWith(
      'at',
      [{ id: 'a', ownerId: accountId, type: 'text_excerpt' }],
      { allowDestructiveShrink: true }
    )
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
  })

  it('sync_then_clear_local 本机无数据时不写空云端', async () => {
    listAllByOwnerIdMock.mockResolvedValue([])
    const result = await handleAuthSignOut('sync_then_clear_local')
    expect(result).toMatchObject({ ok: true, syncedCount: 0, clearedCount: 0 })
    expect(replaceRemoteWithLocalItemsMock).not.toHaveBeenCalled()
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
  })

  it('sync_then_clear_local 本机仅书签时不写云仍清本地', async () => {
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'b', ownerId: accountId, type: 'bookmark' }])
    const result = await handleAuthSignOut('sync_then_clear_local')
    expect(result).toMatchObject({
      ok: true,
      mode: 'sync_then_clear_local',
      syncedCount: 0,
      clearedCount: 1
    })
    expect(replaceRemoteWithLocalItemsMock).not.toHaveBeenCalled()
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
  })

  it('sync_then_clear_local 云端失败时不退出', async () => {
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'a', type: 'text_excerpt' }])
    replaceRemoteWithLocalItemsMock.mockRejectedValue(new Error('network'))
    const result = await handleAuthSignOut('sync_then_clear_local')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('SYNC_REPLACE_LOCAL_FAILED')
    }
    expect(clearAuthSessionMock).not.toHaveBeenCalled()
    expect(replaceOwnerItemsMock).not.toHaveBeenCalled()
  })
})
