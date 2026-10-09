import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))
const handleIncrementalMemorySyncMock = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })))
const getSyncPrefsMock = vi.hoisted(() => vi.fn(async () => ({ enabled: false })))
const ensureMemoryCloudSyncAlarmMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/background/handlers/account-sync-handler', () => ({
  handleIncrementalMemorySync: handleIncrementalMemorySyncMock
}))

vi.mock('@/infrastructure/identity/sync-prefs-service', () => ({
  getSyncPrefs: getSyncPrefsMock
}))

vi.mock('@/infrastructure/sync/memory-cloud-sync-alarm', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/infrastructure/sync/memory-cloud-sync-alarm')>()
  return {
    ...actual,
    ensureMemoryCloudSyncAlarm: ensureMemoryCloudSyncAlarmMock
  }
})

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { MEMORY_CLOUD_SYNC_ALARM_NAME } from '@/infrastructure/sync/memory-cloud-sync-alarm'
import {
  isMemoryCloudSyncAlarmListenerRegistered,
  registerMemoryCloudSyncAlarmListener,
  resetMemoryCloudSyncAlarmListenerForTests
} from '@/background/listeners/memory-cloud-sync-alarm'

describe('memory-cloud-sync-alarm listener', () => {
  beforeEach(() => {
    resetMemoryCloudSyncAlarmListenerForTests()
    vi.clearAllMocks()
    getSyncPrefsMock.mockResolvedValue({ enabled: false })
    handleIncrementalMemorySyncMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('chrome', {
      alarms: {
        onAlarm: { addListener: vi.fn() },
        create: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined)
      }
    })
  })

  it('registerMemoryCloudSyncAlarmListener 幂等注册 onAlarm', () => {
    registerMemoryCloudSyncAlarmListener()
    registerMemoryCloudSyncAlarmListener()

    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1)
    expect(isMemoryCloudSyncAlarmListenerRegistered()).toBe(true)
  })

  it('注册时按 syncPrefs 对齐闹钟', async () => {
    getSyncPrefsMock.mockResolvedValue({ enabled: true })
    registerMemoryCloudSyncAlarmListener()

    await vi.waitFor(() => {
      expect(ensureMemoryCloudSyncAlarmMock).toHaveBeenCalledWith(true)
    })
  })

  it('onAlarm 匹配名前先 await bootstrap 再增量同步', async () => {
    registerMemoryCloudSyncAlarmListener()

    const onAlarm = (chrome.alarms.onAlarm.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (alarm: chrome.alarms.Alarm) => void

    onAlarm({
      name: MEMORY_CLOUD_SYNC_ALARM_NAME,
      scheduledTime: Date.now(),
      periodInMinutes: 15,
      persistAcrossSessions: true
    })

    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalledTimes(1)
      expect(handleIncrementalMemorySyncMock).toHaveBeenCalledTimes(1)
    })
  })

  it('忽略非云同步闹钟名', async () => {
    registerMemoryCloudSyncAlarmListener()

    const onAlarm = (chrome.alarms.onAlarm.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (alarm: chrome.alarms.Alarm) => void

    onAlarm({ name: 'other.alarm', scheduledTime: Date.now(), persistAcrossSessions: true })

    await Promise.resolve()
    await Promise.resolve()

    expect(ensureBackgroundBootstrappedMock).not.toHaveBeenCalled()
    expect(handleIncrementalMemorySyncMock).not.toHaveBeenCalled()
  })
})
