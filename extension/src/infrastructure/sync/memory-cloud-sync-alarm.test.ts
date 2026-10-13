import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  MEMORY_CLOUD_SYNC_ALARM_NAME,
  MEMORY_CLOUD_SYNC_PERIOD_MINUTES,
  ensureMemoryCloudSyncAlarm
} from '@/infrastructure/sync/memory-cloud-sync-alarm'

describe('ensureMemoryCloudSyncAlarm', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      alarms: {
        create: vi.fn(async () => undefined),
        clear: vi.fn(async () => true)
      }
    })
  })

  it('sync 关闭时清除闹钟', async () => {
    await ensureMemoryCloudSyncAlarm(false)

    expect(chrome.alarms.clear).toHaveBeenCalledWith(MEMORY_CLOUD_SYNC_ALARM_NAME)
    expect(chrome.alarms.create).not.toHaveBeenCalled()
  })

  it('sync 开启时创建周期闹钟', async () => {
    await ensureMemoryCloudSyncAlarm(true)

    expect(chrome.alarms.create).toHaveBeenCalledWith(MEMORY_CLOUD_SYNC_ALARM_NAME, {
      periodInMinutes: MEMORY_CLOUD_SYNC_PERIOD_MINUTES
    })
    expect(chrome.alarms.clear).not.toHaveBeenCalled()
  })
})
