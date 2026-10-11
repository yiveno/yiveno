/**
 * 扩展租约探测闹钟：周期跑 GET_AUTH_STATE（含 lease probe），被挤掉后无需开 Panel。
 */

import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { handleGetAuthState } from '@/background/handlers/account-sync-handler'
import {
  AUTH_SESSION_LEASE_ALARM_NAME,
  ensureAuthSessionLeaseAlarm
} from '@/infrastructure/auth/auth-session-lease-alarm'
import { getAccountBinding } from '@/infrastructure/identity/local-profile-service'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { logger } from '@/infrastructure/logging/logger'

let listenerRegistered = false

/** 注册 onAlarm；启动时按本地登录态对齐闹钟。 */
export function registerAuthSessionLeaseAlarmListener(): void {
  if (listenerRegistered) {
    return
  }
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('Auth', '无法注册租约探测闹钟：chrome.alarms 不可用')
    return
  }

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== AUTH_SESSION_LEASE_ALARM_NAME) {
      return
    }
    void (async () => {
      try {
        await ensureBackgroundBootstrapped()
        await handleGetAuthState()
      } catch (error) {
        logger.warn('Auth', '租约探测闹钟执行失败', error)
      }
    })()
  })
  listenerRegistered = true

  void (async () => {
    try {
      const [binding, session] = await Promise.all([getAccountBinding(), getAuthSession()])
      await ensureAuthSessionLeaseAlarm(Boolean(binding && session))
    } catch (error) {
      logger.warn('Auth', '启动时对齐租约探测闹钟失败', error)
    }
  })()
}
