import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountBindingMock,
  getOrCreateLocalProfileMock,
  getAuthSessionMock,
  patchSyncPrefsMock,
  remapOwnerIdMock,
  listAllByOwnerIdMock,
  replaceRemoteWithLocalItemsMock,
  fetchRemoteSyncStatusMock
} = vi.hoisted(() => ({
  getAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  remapOwnerIdMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceRemoteWithLocalItemsMock: vi.fn(),
  fetchRemoteSyncStatusMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  clearAuthSession: vi.fn(),
  getAuthSession: getAuthSessionMock,
  setAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  clearAccountBinding: vi.fn(),
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock,
  setAccountBinding: vi.fn()
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: vi.fn(async () => ({ enabled: false })),
  patchSyncPrefs: patchSyncPrefsMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: remapOwnerIdMock,
    listAllByOwnerId: listAllByOwnerIdMock,
    replaceOwnerItems: vi.fn()
  }
}))

vi.mock('@/infrastructure/messaging/memory-sync-api-client', () => ({
  fetchRemoteSyncStatus: fetchRemoteSyncStatusMock,
  pullRemoteMemoryItems: vi.fn(),
  replaceRemoteWithLocalItems: replaceRemoteWithLocalItemsMock
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: vi.fn(),
  revalidateAuthSession: vi.fn()
}))

vi.mock('@/application/identity/absorb-local-profile-into-account', () => ({
  absorbLocalProfileIntoAccount: vi.fn(async () => 0)
}))

vi.mock('@/infrastructure/browser/website-page', () => ({
  getWebsiteBaseUrl: () => 'https://yiveno.com',
  openWebsiteLoginPage: vi.fn(),
  openWebsiteLogoutFromExtension: vi.fn()
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { handleSyncReplaceWithLocal } from '@/background/handlers/account-sync-handler'

const accountId = '22222222-2222-4222-8222-222222222222'
const localProfileId = '11111111-1111-4111-8111-111111111111'

describe('handleSyncReplaceWithLocal', () => {
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
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: accountId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    patchSyncPrefsMock.mockResolvedValue({ enabled: true })
    remapOwnerIdMock.mockResolvedValue(0)
  })

  it('本机有数据时覆盖云端', async () => {
    const items = [{ id: 'a', ownerId: accountId }]
    listAllByOwnerIdMock.mockResolvedValue(items)
    replaceRemoteWithLocalItemsMock.mockResolvedValue({ written: 1, backupId: 'bak' })

    const result = await handleSyncReplaceWithLocal()
    expect(result).toEqual({ ok: true, written: 1, backupId: 'bak' })
    expect(replaceRemoteWithLocalItemsMock).toHaveBeenCalledWith('at', items)
    expect(fetchRemoteSyncStatusMock).not.toHaveBeenCalled()
  })

  it('本机空且云端有数 → SYNC_REPLACE_LOCAL_EMPTY', async () => {
    listAllByOwnerIdMock.mockResolvedValue([])
    fetchRemoteSyncStatusMock.mockResolvedValue({ remoteCount: 3, latestUpdatedAt: null })

    const result = await handleSyncReplaceWithLocal()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('SYNC_REPLACE_LOCAL_EMPTY')
    }
    expect(replaceRemoteWithLocalItemsMock).not.toHaveBeenCalled()
  })

  it('本机空且云端空 → 跳过写云仍成功', async () => {
    listAllByOwnerIdMock.mockResolvedValue([])
    fetchRemoteSyncStatusMock.mockResolvedValue({ remoteCount: 0, latestUpdatedAt: null })

    const result = await handleSyncReplaceWithLocal()
    expect(result).toEqual({ ok: true, written: 0, backupId: '' })
    expect(replaceRemoteWithLocalItemsMock).not.toHaveBeenCalled()
    expect(patchSyncPrefsMock).toHaveBeenCalledWith({ enabled: true })
  })

  it('Worker 返回 empty_local_replace_denied → 映射为空库错误码', async () => {
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'race' }])
    replaceRemoteWithLocalItemsMock.mockRejectedValue(new Error('empty_local_replace_denied'))

    const result = await handleSyncReplaceWithLocal()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('SYNC_REPLACE_LOCAL_EMPTY')
    }
  })
})
