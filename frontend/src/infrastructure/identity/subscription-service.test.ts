import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getSyncPrefsMock,
  patchSyncPrefsMock,
  ensureMemoryCloudSyncAlarmMock,
  getSubscriptionSnapshotMock,
  writeChromeStorageLocalMock,
  getAuthSessionMock,
  getAccountBindingMock,
  fetchRemoteSubscriptionStatusMock
} = vi.hoisted(() => ({
  getSyncPrefsMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn(),
  getSubscriptionSnapshotMock: vi.fn(),
  writeChromeStorageLocalMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  fetchRemoteSubscriptionStatusMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: getSyncPrefsMock,
  patchSyncPrefs: patchSyncPrefsMock
}))

vi.mock('@/infrastructure/sync/memory-cloud-sync-alarm', () => ({
  ensureMemoryCloudSyncAlarm: ensureMemoryCloudSyncAlarmMock
}))

vi.mock('@/infrastructure/storage/chrome-storage-local', () => ({
  readChromeStorageLocal: getSubscriptionSnapshotMock,
  writeChromeStorageLocal: writeChromeStorageLocalMock,
  removeChromeStorageLocal: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: getAccountBindingMock
}))

vi.mock('@/infrastructure/identity/subscription-api-client', () => ({
  fetchRemoteSubscriptionStatus: fetchRemoteSubscriptionStatusMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: vi.fn(() => 0),
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  enforceSyncRequiresPro,
  refreshSubscriptionSnapshot
} from '@/infrastructure/identity/subscription-service'
import {
  SUBSCRIPTION_SNAPSHOT_STORAGE_KEY,
  SubscriptionRefreshError
} from '@/core/identity/subscription-snapshot'

describe('enforceSyncRequiresPro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)
  })

  it('同步已关 → 不改 prefs', async () => {
    getSyncPrefsMock.mockResolvedValue({ enabled: false })
    await enforceSyncRequiresPro()
    expect(patchSyncPrefsMock).not.toHaveBeenCalled()
    expect(ensureMemoryCloudSyncAlarmMock).not.toHaveBeenCalled()
  })

  it('同步开且有效 Pro → 保持', async () => {
    getSyncPrefsMock.mockResolvedValue({ enabled: true })
    getSubscriptionSnapshotMock.mockResolvedValue({
      isPro: true,
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      fetchedAt: new Date().toISOString()
    })
    await enforceSyncRequiresPro()
    expect(getSubscriptionSnapshotMock).toHaveBeenCalledWith(
      SUBSCRIPTION_SNAPSHOT_STORAGE_KEY,
      expect.anything()
    )
    expect(patchSyncPrefsMock).not.toHaveBeenCalled()
  })

  it('同步开且非 Pro → 关闭同步并清闹钟', async () => {
    getSyncPrefsMock.mockResolvedValue({ enabled: true })
    getSubscriptionSnapshotMock.mockResolvedValue({
      isPro: false,
      tier: 'free',
      status: 'inactive',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      fetchedAt: new Date().toISOString()
    })
    await enforceSyncRequiresPro()
    expect(patchSyncPrefsMock).toHaveBeenCalledWith({ enabled: false })
    expect(ensureMemoryCloudSyncAlarmMock).toHaveBeenCalledWith(false)
  })

  it('同步开但无快照 → 不误关同步', async () => {
    getSyncPrefsMock.mockResolvedValue({ enabled: true })
    getSubscriptionSnapshotMock.mockResolvedValue(null)
    await enforceSyncRequiresPro()
    expect(patchSyncPrefsMock).not.toHaveBeenCalled()
  })
})

describe('refreshSubscriptionSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAccountBindingMock.mockResolvedValue({ accountId: 'acct-1' })
    getAuthSessionMock.mockResolvedValue({ accessToken: 'token' })
    getSyncPrefsMock.mockResolvedValue({ enabled: true })
    patchSyncPrefsMock.mockResolvedValue({ enabled: false })
    ensureMemoryCloudSyncAlarmMock.mockResolvedValue(undefined)
    writeChromeStorageLocalMock.mockResolvedValue(undefined)
  })

  it('拉取失败且有 Pro 快照 → 沿用，不写 Free', async () => {
    const existing = {
      isPro: true,
      tier: 'pro' as const,
      status: 'active' as const,
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      fetchedAt: new Date().toISOString()
    }
    getSubscriptionSnapshotMock.mockResolvedValue(existing)
    fetchRemoteSubscriptionStatusMock.mockRejectedValue(new Error('missing_authorization'))

    const snapshot = await refreshSubscriptionSnapshot({ force: true })
    expect(snapshot).toEqual(existing)
    expect(writeChromeStorageLocalMock).not.toHaveBeenCalled()
  })

  it('拉取失败且无快照 → 抛错，不写 Free', async () => {
    getSubscriptionSnapshotMock.mockResolvedValue(null)
    fetchRemoteSubscriptionStatusMock.mockRejectedValue(new Error('missing_authorization'))

    await expect(refreshSubscriptionSnapshot({ force: true })).rejects.toBeInstanceOf(
      SubscriptionRefreshError
    )
    expect(writeChromeStorageLocalMock).not.toHaveBeenCalled()
  })
})
