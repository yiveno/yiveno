import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountBindingMock,
  getAuthSessionMock,
  setAuthSessionMock,
  refreshAuthProfileFieldsMock,
  refreshAuthSessionMock
} = vi.hoisted(() => ({
  getAccountBindingMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  setAuthSessionMock: vi.fn(),
  refreshAuthProfileFieldsMock: vi.fn(),
  refreshAuthSessionMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  clearAuthSession: vi.fn(),
  getAuthSession: getAuthSessionMock,
  setAuthSession: setAuthSessionMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  clearAccountBinding: vi.fn(),
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: vi.fn(),
  setAccountBinding: vi.fn()
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: vi.fn(async () => ({ enabled: false })),
  patchSyncPrefs: vi.fn()
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: vi.fn(),
    listAllByOwnerId: vi.fn(),
    replaceOwnerItems: vi.fn(),
    listOwnerBucketSummaries: vi.fn()
  }
}))

vi.mock('@/infrastructure/messaging/memory-sync-api-client', () => ({
  fetchRemoteSyncStatus: vi.fn(),
  pullRemoteMemoryItems: vi.fn(),
  replaceRemoteWithLocalItems: vi.fn()
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: refreshAuthSessionMock,
  refreshAuthProfileFields: refreshAuthProfileFieldsMock
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: vi.fn(),
  revalidateAuthSession: vi.fn()
}))

vi.mock('@/application/identity/absorb-local-profile-into-account', () => ({
  absorbLocalProfileIntoAccount: vi.fn(async () => 0)
}))

vi.mock('@/application/identity/orphan-owner-buckets', () => ({
  clearOrphanOwnerBuckets: vi.fn(),
  exportOrphanOwnerBuckets: vi.fn(),
  summarizeOrphanOwnerBuckets: vi.fn()
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

import { handleRefreshAuthProfile } from '@/background/handlers/account-sync-handler'

const accountId = '22222222-2222-4222-8222-222222222222'

describe('handleRefreshAuthProfile', () => {
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
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      email: 'old@example.com'
    })
  })

  it('未登录 → SYNC_NOT_AUTHENTICATED', async () => {
    getAccountBindingMock.mockResolvedValue(null)
    const result = await handleRefreshAuthProfile()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('SYNC_NOT_AUTHENTICATED')
    }
  })

  it('getUser 成功则写回 session 并返回头像', async () => {
    refreshAuthProfileFieldsMock.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: accountId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      email: 'u@example.com',
      avatarUrl: 'https://example.com/a.png',
      displayName: '奇文'
    })

    const result = await handleRefreshAuthProfile()
    expect(result).toEqual({
      ok: true,
      email: 'u@example.com',
      avatarUrl: 'https://example.com/a.png',
      displayName: '奇文'
    })
    expect(setAuthSessionMock).toHaveBeenCalled()
  })

  it('getUser 失败 → AUTH_PROFILE_REFRESH_FAILED', async () => {
    refreshAuthProfileFieldsMock.mockResolvedValue(null)
    const result = await handleRefreshAuthProfile()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('AUTH_PROFILE_REFRESH_FAILED')
    }
    expect(setAuthSessionMock).not.toHaveBeenCalled()
  })
})
