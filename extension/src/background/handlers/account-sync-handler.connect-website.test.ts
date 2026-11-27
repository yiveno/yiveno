import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDeviceSessionMock,
  getAuthSessionMock,
  beginUiBridgeConnectWaitMock,
  broadcastRequestExtensionConnectMock,
  clearUiBridgeConnectWaitMock,
  getUiBridgePortCountMock,
  openWebsiteAccountConnectPageMock
} = vi.hoisted(() => ({
  getDeviceSessionMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  beginUiBridgeConnectWaitMock: vi.fn(),
  broadcastRequestExtensionConnectMock: vi.fn(() => 1),
  clearUiBridgeConnectWaitMock: vi.fn(),
  getUiBridgePortCountMock: vi.fn(() => 1),
  openWebsiteAccountConnectPageMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  clearDeviceSession: vi.fn(),
  setDeviceSession: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock,
  clearAuthSession: vi.fn(),
  setAuthSession: vi.fn()
}))

vi.mock('@/background/listeners/ui-bridge', () => ({
  beginUiBridgeConnectWait: beginUiBridgeConnectWaitMock,
  broadcastRequestExtensionConnect: broadcastRequestExtensionConnectMock,
  clearUiBridgeConnectWait: clearUiBridgeConnectWaitMock,
  getUiBridgePortCount: getUiBridgePortCountMock
}))

vi.mock('@/infrastructure/browser/website-page', () => ({
  getWebsiteBaseUrl: () => 'https://yiveno.com',
  openWebsiteAccountConnectPage: openWebsiteAccountConnectPageMock,
  openWebsiteLoginPage: vi.fn()
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

// 其余 handler 依赖：最小 stub，避免 import 链炸
vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: vi.fn(),
  clearAccountBinding: vi.fn(),
  getOrCreateLocalProfile: vi.fn(),
  setAccountBinding: vi.fn()
}))
vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: vi.fn(async () => ({ enabled: false })),
  patchSyncPrefs: vi.fn()
}))
vi.mock('@/infrastructure/identity/subscription-service', () => ({
  clearSubscriptionSnapshot: vi.fn(),
  refreshSubscriptionSnapshot: vi.fn(),
  isProActiveFromSnapshot: vi.fn(() => false)
}))
vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: vi.fn(),
  revalidateAuthSession: vi.fn()
}))
vi.mock('@/infrastructure/auth/device-session-revalidate', () => ({
  revalidateDeviceSession: vi.fn()
}))
vi.mock('@/infrastructure/auth/ensure-device-session-ready', () => ({
  ensureDeviceSessionReady: vi.fn()
}))
vi.mock('@/infrastructure/auth/ensure-anonymous-device-session', () => ({
  ensureAnonymousDeviceSession: vi.fn()
}))
vi.mock('@/infrastructure/auth/turnstile-token-provider', () => ({
  clearAnonymousCaptchaRetryNeeded: vi.fn(),
  getTurnstileToken: vi.fn(),
  isAnonymousCaptchaRetryNeeded: vi.fn(() => false)
}))
vi.mock('@/infrastructure/auth/extension-uninstall-url', () => ({
  clearExtensionUninstallRevoke: vi.fn()
}))
vi.mock('@/infrastructure/auth/website-auth-probe', () => ({
  probeWebsiteSignedIn: vi.fn()
}))
vi.mock('@/infrastructure/auth/apply-incoming-device-session', () => ({
  applyIncomingDeviceSession: vi.fn()
}))
vi.mock('@/infrastructure/auth/bind-otp-api-client', () => ({
  claimByOtpApi: vi.fn(),
  requestBindCodeApi: vi.fn(),
  verifyBindCodeApi: vi.fn()
}))
vi.mock('@/infrastructure/auth/device-register-api-client', () => ({
  deviceSessionFromRegisterData: vi.fn(),
  revokeOwnDeviceToken: vi.fn()
}))
vi.mock('@/infrastructure/auth/promote-anonymous-api-client', () => ({
  promoteAnonymousViaApi: vi.fn()
}))
vi.mock('@/infrastructure/identity/anon-exchange-401-backoff-service', () => ({
  clearAnonExchange401Backoff: vi.fn()
}))
vi.mock('@/infrastructure/identity/privacy-prefs-service', () => ({
  getPrivacyPrefs: vi.fn()
}))
vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {}
}))
vi.mock('@/infrastructure/messaging/memory-sync-api-client', () => ({
  fetchRemoteSyncStatus: vi.fn(),
  pullRemoteMemoryItems: vi.fn(),
  pushRemoteMemoryItems: vi.fn(),
  replaceRemoteWithLocalItems: vi.fn(),
  restoreRemoteFromLatestBackup: vi.fn()
}))
vi.mock('@/application/identity/orphan-owner-buckets', () => ({
  summarizeOrphanOwnerBuckets: vi.fn()
}))
vi.mock('@/application/identity/clear-account-library-on-sign-out', () => ({
  clearAccountLibraryOnSignOut: vi.fn(),
  remapAccountLibraryToLocalProfile: vi.fn()
}))
vi.mock('@/application/memory/bookmark-sync-alignment-cache', () => ({
  invalidateBookmarkSyncAlignmentCache: vi.fn()
}))
vi.mock('@/infrastructure/storage/sign-out-remap-notice-storage', () => ({
  writeSignOutRemapNotice: vi.fn()
}))
vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthProfileFields: vi.fn()
}))
vi.mock('@/infrastructure/mcp/mcp-api-client', () => ({
  putMcpReadOnlyRemote: vi.fn()
}))
vi.mock('@/infrastructure/browser/browser-online', () => ({
  readBrowserOnline: () => true
}))

import { handleAuthConnectWebsite } from './account-sync-handler'

describe('handleAuthConnectWebsite（AN5 三态）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-test-id' },
      storage: {
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    })
    getUiBridgePortCountMock.mockReturnValue(1)
    broadcastRequestExtensionConnectMock.mockReturnValue(1)
  })

  it('匿名扩展 + 官网接通路径：不 alreadySignedIn 短路，会广播 Connect', async () => {
    getDeviceSessionMock.mockResolvedValue({
      userId: 'anon-user',
      deviceToken: 'ydt_' + 'a'.repeat(64),
      deviceId: 'dev-anon',
      isAnonymous: true,
      createdAt: new Date().toISOString()
    })
    getAuthSessionMock.mockResolvedValue(null)

    beginUiBridgeConnectWaitMock.mockImplementation(
      (handlers: { onResult: (status: string) => void }) => {
        queueMicrotask(() => handlers.onResult('ok'))
      }
    )

    const result = await handleAuthConnectWebsite()
    expect(result).toEqual({ ok: true, path: 'bridge' })
    expect(broadcastRequestExtensionConnectMock).toHaveBeenCalledWith('ext-test-id')
    expect(beginUiBridgeConnectWaitMock).toHaveBeenCalled()
  })

  it('真实异账号已登录：alreadySignedIn 短路（不静默覆盖；mismatch 由官网 probe 处理）', async () => {
    getDeviceSessionMock.mockResolvedValue({
      userId: 'real-user-a',
      deviceToken: 'ydt_' + 'b'.repeat(64),
      deviceId: 'dev-a',
      isAnonymous: false,
      createdAt: new Date().toISOString()
    })

    const result = await handleAuthConnectWebsite()
    expect(result).toEqual({ ok: true, path: 'bridge' })
    expect(broadcastRequestExtensionConnectMock).not.toHaveBeenCalled()
  })

  it('同账号已真实登录：alreadySignedIn 幂等，不重 register', async () => {
    getDeviceSessionMock.mockResolvedValue({
      userId: 'same-user',
      deviceToken: 'ydt_' + 'c'.repeat(64),
      deviceId: 'dev-same',
      isAnonymous: false,
      createdAt: new Date().toISOString()
    })

    const result = await handleAuthConnectWebsite()
    expect(result).toEqual({ ok: true, path: 'bridge' })
    expect(broadcastRequestExtensionConnectMock).not.toHaveBeenCalled()
  })
})
