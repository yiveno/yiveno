import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CHROME_BOOKMARK_REPAIR_ALARM_NAME,
  CHROME_BOOKMARK_REPAIR_PERIOD_MINUTES,
  ensureChromeBookmarkRepairAlarm
} from '@/infrastructure/sync/chrome-bookmark-repair-alarm'

describe('ensureChromeBookmarkRepairAlarm', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      alarms: {
        create: vi.fn(async () => undefined),
        clear: vi.fn(async () => true)
      }
    })
  })

  it('关闭时清除闹钟', async () => {
    await ensureChromeBookmarkRepairAlarm(false)
    expect(chrome.alarms.clear).toHaveBeenCalledWith(CHROME_BOOKMARK_REPAIR_ALARM_NAME)
    expect(chrome.alarms.create).not.toHaveBeenCalled()
  })

  it('开启时挂每日周期闹钟', async () => {
    await ensureChromeBookmarkRepairAlarm(true)
    expect(chrome.alarms.create).toHaveBeenCalledWith(CHROME_BOOKMARK_REPAIR_ALARM_NAME, {
      periodInMinutes: CHROME_BOOKMARK_REPAIR_PERIOD_MINUTES
    })
    expect(chrome.alarms.clear).not.toHaveBeenCalled()
  })
})
