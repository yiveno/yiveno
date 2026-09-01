import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CHROME_STORAGE_QUOTA_WARN_RATIO,
  computeChromeStorageUsageRatio,
  isChromeStorageQuotaHigh,
  logChromeStorageQuotaSample,
  readChromeStorageAreaQuota
} from '@/infrastructure/storage/chrome-storage-quota'
import { logger } from '@/infrastructure/logging/logger'

describe('chrome-storage-quota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          getBytesInUse: vi.fn(async () => 0),
          QUOTA_BYTES: 10_485_760
        },
        session: {
          getBytesInUse: vi.fn(async () => 0),
          QUOTA_BYTES: 10_485_760
        }
      }
    })
  })

  it('computeChromeStorageUsageRatio 处理边界', () => {
    expect(computeChromeStorageUsageRatio(5_242_880, 10_485_760)).toBeCloseTo(0.5)
    expect(computeChromeStorageUsageRatio(100, 0)).toBe(0)
  })

  it('readChromeStorageAreaQuota 读取 local 快照', async () => {
    vi.mocked(chrome.storage.local.getBytesInUse).mockResolvedValue(1_048_576)

    await expect(readChromeStorageAreaQuota('local')).resolves.toEqual({
      area: 'local',
      bytesInUse: 1_048_576,
      quotaBytes: 10_485_760,
      usageRatio: 1_048_576 / 10_485_760
    })
  })

  it('isChromeStorageQuotaHigh 按阈值判定', () => {
    expect(
      isChromeStorageQuotaHigh({
        area: 'local',
        bytesInUse: 9_000_000,
        quotaBytes: 10_000_000,
        usageRatio: 0.9
      })
    ).toBe(true)
    expect(
      isChromeStorageQuotaHigh({
        area: 'local',
        bytesInUse: 1_000_000,
        quotaBytes: 10_000_000,
        usageRatio: 0.1
      })
    ).toBe(false)
    expect(CHROME_STORAGE_QUOTA_WARN_RATIO).toBe(0.8)
  })

  it('logChromeStorageQuotaSample 用量正常时不打日志', async () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    await logChromeStorageQuotaSample('bootstrap')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('logChromeStorageQuotaSample 超阈值时 warn', async () => {
    vi.mocked(chrome.storage.local.getBytesInUse).mockResolvedValue(9_500_000)
    const warnSpy = vi.spyOn(logger, 'warn')

    await logChromeStorageQuotaSample('bootstrap')

    expect(warnSpy).toHaveBeenCalledWith(
      'ChromeStorageQuota',
      'bootstrap：chrome.storage 用量偏高',
      expect.objectContaining({
        scope: 'bootstrap',
        highAreas: ['local']
      })
    )
  })
})
