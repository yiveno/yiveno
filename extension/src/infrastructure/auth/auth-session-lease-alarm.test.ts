import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AUTH_SESSION_LEASE_ALARM_NAME,
  AUTH_SESSION_LEASE_PERIOD_MINUTES,
  ensureAuthSessionLeaseAlarm
} from '@/infrastructure/auth/auth-session-lease-alarm'

describe('ensureAuthSessionLeaseAlarm', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      alarms: {
        clear: vi.fn(async () => true),
        create: vi.fn(async () => undefined)
      }
    })
  })

  it('signedIn=false 清除闹钟', async () => {
    await ensureAuthSessionLeaseAlarm(false)
    expect(chrome.alarms.clear).toHaveBeenCalledWith(AUTH_SESSION_LEASE_ALARM_NAME)
    expect(chrome.alarms.create).not.toHaveBeenCalled()
  })

  it('signedIn=true 挂周期闹钟', async () => {
    await ensureAuthSessionLeaseAlarm(true)
    expect(chrome.alarms.create).toHaveBeenCalledWith(AUTH_SESSION_LEASE_ALARM_NAME, {
      periodInMinutes: AUTH_SESSION_LEASE_PERIOD_MINUTES
    })
  })
})
