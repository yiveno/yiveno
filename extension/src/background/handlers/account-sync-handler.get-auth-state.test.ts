import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  clearAuthSessionMock,
  getAccountBindingMock,
  clearAccountBindingMock,
  getAuthSessionMock,
  getDeviceSessionMock,
  clearDeviceSessionMock,
  patchSyncPrefsMock,
  clearSubscriptionSnapshotMock,
  ensureMemoryCloudSyncAlarmMock,
  revalidateAuthSessionMock,
  revalidateDeviceSessionMock,
  ensureDeviceSessionReadyMock,
  clearAuthValidationTimestampMock,
  clearExtensionUninstallRevokeMock,
  openWebsiteLoginPageMock
} = vi.hoisted(() => ({
  clearAuthSessionMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  clearAccountBindingMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  getDeviceSessionMock: vi.fn(),
  clearDeviceSessionMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  clearSubscriptionSnapshotMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn(),
  revalidateAuthSessionMock: vi.fn(),
  revalidateDeviceSessionMock: vi.fn(),
  ensureDeviceSessionReadyMock: vi.fn(),
  clearAuthValidationTimestampMock: vi.fn(),
  clearExtensionUninstallRevokeMock: vi.fn(),
  openWebsiteLoginPageMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  clearAuthSession: clearAuthSessionMock,
  getAuthSession: getAuthSessionMock,
  setAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  clearDeviceSession: clearDeviceSessionMock,
  setDeviceSession: vi.fn()
}))

vi.mock('@/infrastructure/auth/ensure-device-session-ready', () => ({
  ensureDeviceSessionReady: ensureDeviceSessionReadyMock
}))

vi.mock('@/infrastructure/auth/device-session-revalidate', () => ({
  revalidateDeviceSession: revalidateDeviceSessionMock
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

const {
  listAllByOwnerIdMock,
  replaceRemoteWithLocalItemsMock,
  remapAccountLibraryToLocalProfileMock,
  writeSignOutRemapNoticeMock
} = vi.hoisted(() => ({
  listAllByOwnerIdMock: vi.fn(async () => [] as unknown[]),
  replaceRemoteWithLocalItemsMock: vi.fn(),
  remapAccountLibraryToLocalProfileMock: vi.fn(async () => ({
    clearedCount: 0,
    remappedBookmarks: 0,
    remappedExcerpts: 0
  })),
  writeSignOutRemapNoticeMock: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: vi.fn(),
    listAllByOwnerId: listAllByOwnerIdMock,
    replaceOwnerItems: vi.fn()
  }
}))

vi.mock('@/application/identity/clear-account-library-on-sign-out', () => ({
  clearAccountLibraryOnSignOut: vi.fn(async () => ({
    clearedCount: 0,
    remappedBookmarks: 0,
    remappedExcerpts: 0
  })),
  remapAccountLibraryToLocalProfile: remapAccountLibraryToLocalProfileMock
}))

vi.mock('@/infrastructure/storage/sign-out-remap-notice-storage', () => ({
  writeSignOutRemapNotice: writeSignOutRemapNoticeMock
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
  refreshAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: clearAuthValidationTimestampMock,
  revalidateAuthSession: revalidateAuthSessionMock
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

describe('handleGetAuthState · refresh 作废', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', { runtime: { id: 'ext-under-test' } })
    getAccountBindingMock.mockResolvedValue({
      accountId,
      boundAt: '2026-08-01T00:00:00.000Z'
    })
    getDeviceSessionMock.mockResolvedValue(null)
    ensureDeviceSessionReadyMock.mockResolvedValue({ device: null, note: 'no_legacy' })
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: accountId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    clearAuthSessionMock.mockResolvedValue(undefined)
    clearDeviceSessionMock.mockResolvedValue(undefined)
    clearAccountBindingMock.mockResolvedValue(undefined)
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    clearSubscriptionSnapshotMock.mockResolvedValue(undefined)
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)
    clearAuthValidationTimestampMock.mockResolvedValue(undefined)
    clearExtensionUninstallRevokeMock.mockResolvedValue(false)
    openWebsiteLoginPageMock.mockResolvedValue(undefined)
    listAllByOwnerIdMock.mockResolvedValue([])
    remapAccountLibraryToLocalProfileMock.mockResolvedValue({
      clearedCount: 0,
      remappedBookmarks: 0,
      remappedExcerpts: 0
    })
    writeSignOutRemapNoticeMock.mockResolvedValue(undefined)
  })

  it('revalidate invalid → 全量回迁 + flush 成功文案', async () => {
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
    expect(remapAccountLibraryToLocalProfileMock).toHaveBeenCalledWith(accountId)
    expect(writeSignOutRemapNoticeMock).toHaveBeenCalledWith(true)
    expect(clearAuthSessionMock).toHaveBeenCalled()
    expect(clearAccountBindingMock).toHaveBeenCalled()
    expect(clearExtensionUninstallRevokeMock).toHaveBeenCalledWith({
      revokeRemote: true
    })
    expect(openWebsiteLoginPageMock).not.toHaveBeenCalled()
  })

  it('revalidate invalid + flush 失败 → 回迁保留并写 flushOk=false 提示', async () => {
    revalidateAuthSessionMock.mockResolvedValue({
      status: 'invalid',
      reason: 'session_revoked'
    })
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', ownerId: accountId, type: 'text_excerpt', updatedAt: '2026-01-01T00:00:00.000Z' }
    ])
    replaceRemoteWithLocalItemsMock.mockRejectedValue(new Error('network'))

    await handleGetAuthState()

    expect(remapAccountLibraryToLocalProfileMock).toHaveBeenCalledWith(accountId)
    expect(writeSignOutRemapNoticeMock).toHaveBeenCalledWith(false)
    expect(clearAuthSessionMock).toHaveBeenCalled()
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

  it('device 会话 401 invalid + 正式 → 全量回迁，不走 uninstall revoke', async () => {
    const device = {
      deviceToken: 'ydt_' + 'd'.repeat(64),
      deviceId: '33333333-3333-4333-8333-333333333333',
      userId: accountId,
      isAnonymous: false,
      createdAt: '2026-11-20T08:00:00.000Z'
    }
    getDeviceSessionMock.mockResolvedValue(device)
    ensureDeviceSessionReadyMock.mockResolvedValue({ device, note: 'already_device' })
    revalidateDeviceSessionMock.mockResolvedValue({
      status: 'invalid',
      reason: 'device_token_unauthorized'
    })

    const result = await handleGetAuthState()

    expect(result).toEqual({
      ok: true,
      signedIn: false,
      binding: null,
      syncPrefs: { enabled: true }
    })
    expect(remapAccountLibraryToLocalProfileMock).toHaveBeenCalledWith(accountId)
    expect(writeSignOutRemapNoticeMock).toHaveBeenCalledWith(true)
    expect(clearDeviceSessionMock).toHaveBeenCalled()
    expect(clearAccountBindingMock).toHaveBeenCalled()
    expect(clearExtensionUninstallRevokeMock).not.toHaveBeenCalled()
    expect(revalidateAuthSessionMock).not.toHaveBeenCalled()
  })

  it('device 会话 401 invalid + 匿名 → 仅清会话/binding，不回迁', async () => {
    const device = {
      deviceToken: 'ydt_' + 'a'.repeat(64),
      deviceId: '33333333-3333-4333-8333-333333333333',
      userId: accountId,
      isAnonymous: true,
      createdAt: '2026-11-20T08:00:00.000Z'
    }
    getDeviceSessionMock.mockResolvedValue(device)
    ensureDeviceSessionReadyMock.mockResolvedValue({ device, note: 'already_device' })
    revalidateDeviceSessionMock.mockResolvedValue({
      status: 'invalid',
      reason: 'device_token_unauthorized'
    })

    await handleGetAuthState()

    expect(remapAccountLibraryToLocalProfileMock).not.toHaveBeenCalled()
    expect(writeSignOutRemapNoticeMock).not.toHaveBeenCalled()
    expect(clearDeviceSessionMock).toHaveBeenCalled()
    expect(clearAccountBindingMock).toHaveBeenCalled()
    expect(clearExtensionUninstallRevokeMock).not.toHaveBeenCalled()
  })

  it('device 会话 uncertain → 保留登录态', async () => {
    const device = {
      deviceToken: 'ydt_' + 'u'.repeat(64),
      deviceId: '33333333-3333-4333-8333-333333333333',
      userId: accountId,
      email: 'u@example.com',
      isAnonymous: false,
      createdAt: '2026-11-20T08:00:00.000Z'
    }
    getDeviceSessionMock.mockResolvedValue(device)
    ensureDeviceSessionReadyMock.mockResolvedValue({ device, note: 'already_device' })
    revalidateDeviceSessionMock.mockResolvedValue({
      status: 'uncertain',
      reason: 'http_503'
    })

    const result = await handleGetAuthState()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.signedIn).toBe(true)
    expect(result.isAnonymous).toBe(false)
    expect(result.email).toBe('u@example.com')
    expect(clearDeviceSessionMock).not.toHaveBeenCalled()
  })
})
