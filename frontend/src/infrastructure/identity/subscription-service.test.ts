import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getSyncPrefsMock,
  patchSyncPrefsMock,
  ensureMemoryCloudSyncAlarmMock,
  getSubscriptionSnapshotMock
} = vi.hoisted(() => ({
  getSyncPrefsMock: vi.fn(),
  patchSyncPrefsMock: vi.fn(),
  ensureMemoryCloudSyncAlarmMock: vi.fn(),
  getSubscriptionSnapshotMock: vi.fn()
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
  writeChromeStorageLocal: vi.fn(),
  removeChromeStorageLocal: vi.fn()
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: vi.fn()
}))

vi.mock('@/infrastructure/identity/subscription-api-client', () => ({
  fetchRemoteSubscriptionStatus: vi.fn()
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: vi.fn(() => 0),
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { enforceSyncRequiresPro } from '@/infrastructure/identity/subscription-service'
import { SUBSCRIPTION_SNAPSHOT_STORAGE_KEY } from '@/core/identity/subscription-snapshot'

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
})
