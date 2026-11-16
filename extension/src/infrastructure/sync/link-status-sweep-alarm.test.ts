/**
 * Phase 5：独立死链巡检闹钟 · 开关门禁。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LINK_STATUS_SWEEP_ALARM_NAME,
  LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES,
  ensureLinkStatusSweepAlarm
} from '@/infrastructure/sync/link-status-sweep-alarm'

describe('ensureLinkStatusSweepAlarm', () => {
  const create = vi.fn(async () => undefined)
  const clear = vi.fn(async () => true)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      alarms: { create, clear }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('开关开：创建独立周期闹钟 10080', async () => {
    await ensureLinkStatusSweepAlarm(true)
    expect(create).toHaveBeenCalledWith(LINK_STATUS_SWEEP_ALARM_NAME, {
      periodInMinutes: LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES
    })
    expect(LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES).toBe(10080)
    expect(clear).not.toHaveBeenCalled()
  })

  it('开关关：清除闹钟（不挂空跑）', async () => {
    await ensureLinkStatusSweepAlarm(false)
    expect(clear).toHaveBeenCalledWith(LINK_STATUS_SWEEP_ALARM_NAME)
    expect(create).not.toHaveBeenCalled()
  })
})
