import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))
const sweepMemoryLinkStatusTickMock = vi.hoisted(() =>
  vi.fn(async () => ({
    skipped: false,
    checked: 0,
    markedStale: 0,
    markedUnknown: 0,
    markedOk: 0
  }))
)
const ensureLinkStatusSweepAlarmMock = vi.hoisted(() => vi.fn(async () => undefined))
const getUserSettingsMock = vi.hoisted(() => vi.fn(async () => ({ linkStatusSweepEnabled: true })))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/application/dreaming/sweep-memory-link-status', () => ({
  sweepMemoryLinkStatusTick: sweepMemoryLinkStatusTickMock
}))

vi.mock('@/infrastructure/sync/link-status-sweep-alarm', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/infrastructure/sync/link-status-sweep-alarm')>()
  return {
    ...actual,
    ensureLinkStatusSweepAlarm: ensureLinkStatusSweepAlarmMock
  }
})

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { LINK_STATUS_SWEEP_ALARM_NAME } from '@/infrastructure/sync/link-status-sweep-alarm'
import {
  isLinkStatusSweepAlarmListenerRegistered,
  registerLinkStatusSweepAlarmListener,
  resetLinkStatusSweepAlarmListenerForTests
} from '@/background/listeners/link-status-sweep-alarm'

describe('link-status-sweep-alarm listener', () => {
  beforeEach(() => {
    resetLinkStatusSweepAlarmListenerForTests()
    vi.clearAllMocks()
    getUserSettingsMock.mockResolvedValue({ linkStatusSweepEnabled: true })
    vi.stubGlobal('chrome', {
      alarms: {
        onAlarm: { addListener: vi.fn() },
        create: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined)
      }
    })
  })

  it('registerLinkStatusSweepAlarmListener 幂等注册 onAlarm', () => {
    registerLinkStatusSweepAlarmListener()
    registerLinkStatusSweepAlarmListener()

    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1)
    expect(isLinkStatusSweepAlarmListenerRegistered()).toBe(true)
  })

  it('注册时按开关挂周期闹钟', async () => {
    registerLinkStatusSweepAlarmListener()

    await vi.waitFor(() => {
      expect(ensureLinkStatusSweepAlarmMock).toHaveBeenCalledWith(true)
    })
  })

  it('onAlarm 匹配名前先 await bootstrap 再巡检', async () => {
    registerLinkStatusSweepAlarmListener()

    const onAlarm = (chrome.alarms.onAlarm.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (alarm: chrome.alarms.Alarm) => void

    onAlarm({
      name: LINK_STATUS_SWEEP_ALARM_NAME,
      scheduledTime: Date.now(),
      periodInMinutes: 10080,
      persistAcrossSessions: true
    })

    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
      expect(sweepMemoryLinkStatusTickMock).toHaveBeenCalled()
    })
  })
})
