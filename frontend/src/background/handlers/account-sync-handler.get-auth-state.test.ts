import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  clearAuthSessionMock,
  getAccountBindingMock,
  clearAccountBindingMock,
  getAuthSessionMock,
  patchSyncPrefsMock,
  clearSubscriptionSnapshotMock,
  ensureMemoryCloudSyncAlarmMock,
  revalidateAuthSessionMock,
  clearAuthValidationTimestampMock,
  clearExtensionUninstallRevokeMock,
  openWebsiteLoginPageMock
} = vi.hoisted(() => ({
  clearAuthSessionMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  clearAccountBindingMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  clearSubscriptionSnapshotMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn(),
  revalidateAuthSessionMock: vi.fn(),
  clearAuthValidationTimestampMock: vi.fn(),
  clearExtensionUninstallRevokeMock: vi.fn(),
  openWebsiteLoginPageMock: vi.fn()
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
  getSyncPrefs: vi.fn(async () => ({ enabled: true })),
  patchSyncPrefs: patchSyncPrefsMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: vi.fn(),
    listAllByOwnerId: vi.fn(),
    replaceOwnerItems: vi.fn()
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
  replaceRemoteWithLocalItems: vi.fn()
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: clearAuthValidationTimestampMock,
  revalidateAuthSession: revalidateAuthSessionMock
}))

vi.mock('@/application/identity/absorb-local-profile-into-account', () => ({
  absorbLocalProfileIntoAccount: vi.fn(async () => 0)
}))

vi.mock('@/infrastructure/browser/website-page', () => ({
  getWebsiteBaseUrl: () => 'https://yiveno.com',
  openWebsiteLoginPage: openWebsiteLoginPageMock,
  openWebsiteLogoutFromExtension: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/auth/extension-uninstall-url', () => ({
  clearExtensionUninstallRevoke: clearExtensionUninstallRevokeMock,
  registerExtensionUninstallRevoke: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { handleGetAuthState } from '@/background/handlers/account-sync-handler'

const accountId = '22222222-2222-4222-8222-222222222222'

describe('handleGetAuthState · 被挤掉 / refresh 作废', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', { runtime: { id: 'ext-under-test' } })
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
    clearAuthSessionMock.mockResolvedValue(undefined)
    clearAccountBindingMock.mockResolvedValue(undefined)
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    clearSubscriptionSnapshotMock.mockResolvedValue(undefined)
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)
    clearAuthValidationTimestampMock.mockResolvedValue(undefined)
    clearExtensionUninstallRevokeMock.mockResolvedValue(undefined)
    openWebsiteLoginPageMock.mockResolvedValue(undefined)
  })

  it('revalidate invalid → 清登录态并打开官网 login（connect_extension）', async () => {
    revalidateAuthSessionMock.mockResolvedValue({
      status: 'invalid',
      reason: 'session_revoked'
    })

    const result = await handleGetAuthState()

    expect(result).toEqual({
      ok: true,
      signedIn: false,
      binding: null,
      syncPrefs: { enabled: true }
    })
    expect(clearAuthSessionMock).toHaveBeenCalled()
    expect(clearAccountBindingMock).toHaveBeenCalled()
    expect(clearExtensionUninstallRevokeMock).toHaveBeenCalledWith({ revokeRemote: false })
    expect(openWebsiteLoginPageMock).toHaveBeenCalledWith(
      'https://yiveno.com/login?connect_extension=1&extension_id=ext-under-test'
    )
  })

  it('revalidate uncertain → 保留登录态，不打开 login', async () => {
    revalidateAuthSessionMock.mockResolvedValue({
      status: 'uncertain',
      reason: 'network'
    })

    const result = await handleGetAuthState()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.signedIn).toBe(true)
    expect(clearAuthSessionMock).not.toHaveBeenCalled()
    expect(openWebsiteLoginPageMock).not.toHaveBeenCalled()
  })
})
