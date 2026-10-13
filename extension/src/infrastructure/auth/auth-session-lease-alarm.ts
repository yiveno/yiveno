/**
 * 已登录时周期探测扩展租约（被挤掉后无需用户打开 Side Panel 即可退登）。
 * Chrome MV3 periodInMinutes 最小为 1。
 */

import { logger } from '@/infrastructure/logging/logger'

export const AUTH_SESSION_LEASE_ALARM_NAME = 'yiveno.auth_session_lease' as const

/** 周期（分钟）：尽快发现被挤掉，同时避免打爆 Worker / Supabase。 */
export const AUTH_SESSION_LEASE_PERIOD_MINUTES = 1 as const

/** 按是否已登录创建或清除周期闹钟。 */
export async function ensureAuthSessionLeaseAlarm(signedIn: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('Auth', 'chrome.alarms 不可用，跳过租约探测闹钟', { signedIn })
    return
  }

  if (!signedIn) {
    await chrome.alarms.clear(AUTH_SESSION_LEASE_ALARM_NAME)
    logger.info('Auth', '已清除扩展租约探测闹钟')
    return
  }

  await chrome.alarms.create(AUTH_SESSION_LEASE_ALARM_NAME, {
    periodInMinutes: AUTH_SESSION_LEASE_PERIOD_MINUTES
  })
  logger.info('Auth', '已挂载扩展租约探测闹钟', {
    periodInMinutes: AUTH_SESSION_LEASE_PERIOD_MINUTES
  })
}
