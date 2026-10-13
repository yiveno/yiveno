import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  clearAuthSessionMock,
  getAccountBindingMock,
  clearAccountBindingMock,
  patchSyncPrefsMock,
  listAllByOwnerIdMock,
  replaceOwnerItemsMock,
  getAuthSessionMock,
  deleteRemoteAccountMock,
  clearPrivacyPrefsMock,
  ensureMemoryCloudSyncAlarmMock,
  clearSubscriptionSnapshotMock,
  openWebsiteLogoutFromExtensionMock
} = vi.hoisted(() => ({
  clearAuthSessionMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  clearAccountBindingMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  deleteRemoteAccountMock: vi.fn(),
  clearPrivacyPrefsMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn(),
  clearSubscriptionSnapshotMock: vi.fn(),
  openWebsiteLogoutFromExtensionMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  clearAuthSession: clearAuthSessionMock,
  getAuthSession: getAuthSessionMock,
  setAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  clearAccountBinding: clearAccountBindingMock,
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: vi.fn(),
  setAccountBinding: vi.fn()
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: vi.fn(async () => ({ enabled: false })),
  patchSyncPrefs: patchSyncPrefsMock
}))

vi.mock('@/infrastructure/identity/privacy-prefs-service', () => ({
  ackCurrentPrivacyNotice: vi.fn(),
  clearPrivacyPrefs: clearPrivacyPrefsMock,
  getPrivacyPrefs: vi.fn(async () => ({
    noticeAckedVersion: null,
    noticeAckedAt: null
  }))
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
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
  deleteRemoteAccount: deleteRemoteAccountMock,
  deleteRemoteCloudMemory: vi.fn(),
  fetchRemoteSyncStatus: vi.fn(),
  pullRemoteMemoryItems: vi.fn(),
  pushRemoteMemoryItems: vi.fn(),
  replaceRemoteWithLocalItems: vi.fn(),
  restoreRemoteFromLatestBackup: vi.fn()
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: vi.fn(),
  refreshAuthProfileFields: vi.fn()
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
  openWebsiteLogoutFromExtension: openWebsiteLogoutFromExtensionMock
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

import { handleDeleteAccount } from '@/background/handlers/account-sync-handler'

const accountId = '22222222-2222-4222-8222-222222222222'

describe('handleDeleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAccountBindingMock.mockResolvedValue({
      accountId,
      boundAt: '2026-08-01T00:00:00.000Z'
    })
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: accountId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    deleteRemoteAccountMock.mockResolvedValue({ deletedItems: 3, deletedBackups: 1 })
    listAllByOwnerIdMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    replaceOwnerItemsMock.mockResolvedValue(2)
    clearPrivacyPrefsMock.mockResolvedValue(undefined)
    clearAuthSessionMock.mockResolvedValue(undefined)
    clearAccountBindingMock.mockResolvedValue(undefined)
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)
    clearSubscriptionSnapshotMock.mockResolvedValue(undefined)
    openWebsiteLogoutFromExtensionMock.mockResolvedValue(undefined)
  })

  it('未登录 → SYNC_NOT_AUTHENTICATED', async () => {
    getAccountBindingMock.mockResolvedValue(null)
    const result = await handleDeleteAccount()
    expect(result).toEqual({ ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' })
    expect(deleteRemoteAccountMock).not.toHaveBeenCalled()
  })

  it('成功：清云端、清本机账号桶、退登、重置隐私 ack', async () => {
    const result = await handleDeleteAccount()
    expect(result).toEqual({
      ok: true,
      deletedItems: 3,
      deletedBackups: 1,
      clearedLocalCount: 2
    })
    expect(deleteRemoteAccountMock).toHaveBeenCalledWith('at')
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
    expect(clearPrivacyPrefsMock).toHaveBeenCalled()
    expect(clearAuthSessionMock).toHaveBeenCalled()
    expect(clearAccountBindingMock).toHaveBeenCalled()
    expect(patchSyncPrefsMock).toHaveBeenCalledWith({ enabled: false })
    expect(openWebsiteLogoutFromExtensionMock).toHaveBeenCalled()
  })

  it('远端失败 → ACCOUNT_DELETE_FAILED，不清本机', async () => {
    deleteRemoteAccountMock.mockRejectedValue(new Error('account_delete_failed'))
    const result = await handleDeleteAccount()
    expect(result).toMatchObject({
      ok: false,
      errorCode: 'ACCOUNT_DELETE_FAILED',
      error: 'account_delete_failed'
    })
    expect(replaceOwnerItemsMock).not.toHaveBeenCalled()
    expect(clearAuthSessionMock).not.toHaveBeenCalled()
  })
})
