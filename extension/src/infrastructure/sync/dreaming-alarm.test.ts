import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DREAMING_ALARM_NAME,
  DREAMING_ALARM_PERIOD_MINUTES,
  ensureDreamingAlarm
} from '@/infrastructure/sync/dreaming-alarm'

describe('ensureDreamingAlarm', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      alarms: {
        create: vi.fn(async () => undefined),
        clear: vi.fn(async () => true)
      }
    })
  })

  it('enabled=false 时清除闹钟', async () => {
    await ensureDreamingAlarm(false)
    expect(chrome.alarms.clear).toHaveBeenCalledWith(DREAMING_ALARM_NAME)
    expect(chrome.alarms.create).not.toHaveBeenCalled()
  })

  it('enabled=true 时创建 1440 分钟周期闹钟', async () => {
    await ensureDreamingAlarm(true)
    expect(chrome.alarms.create).toHaveBeenCalledWith(DREAMING_ALARM_NAME, {
      periodInMinutes: DREAMING_ALARM_PERIOD_MINUTES
    })
    expect(chrome.alarms.clear).not.toHaveBeenCalled()
    expect(DREAMING_ALARM_PERIOD_MINUTES).toBe(1440)
  })
})
