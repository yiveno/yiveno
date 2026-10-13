/**
 * 注册云 Memory 定时同步监听：闹钟触发 → 增量 sync。
 */

import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { handleIncrementalMemorySync } from '@/background/handlers/account-sync-handler'
import {
  MEMORY_CLOUD_SYNC_ALARM_NAME,
  ensureMemoryCloudSyncAlarm
} from '@/infrastructure/sync/memory-cloud-sync-alarm'
import { getSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import { logger } from '@/infrastructure/logging/logger'

let registered = false

/** 定时同步写 IDB 前须等 bootstrap（SW 禁止动态 import）。 */
async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

/** 注册 alarms.onAlarm；启动时按偏好对齐闹钟状态。 */
export function registerMemoryCloudSyncAlarmListener(): void {
  if (registered) {
    return
  }
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('MemorySync', '无法注册定时同步：chrome.alarms 不可用')
    return
  }

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== MEMORY_CLOUD_SYNC_ALARM_NAME) {
      return
    }
    void ensureBootstrapReady()
      .then(() => handleIncrementalMemorySync())
      .then(result => {
        if (!result.ok) {
          logger.warn('MemorySync', '定时增量同步未成功', {
            errorCode: result.errorCode,
            ...(result.error ? { error: result.error } : {})
          })
        }
      })
      .catch(error => {
        logger.error('MemorySync', '定时增量同步异常', error)
      })
  })

  registered = true
  logger.info('MemorySync', '云同步定时闹钟监听已注册')

  void getSyncPrefs()
    .then(prefs => ensureMemoryCloudSyncAlarm(prefs.enabled))
    .catch(error => {
      logger.warn('MemorySync', '启动时对齐定时闹钟失败', error)
    })
}

/** 当前是否已挂上闹钟监听（测试 / 诊断用）。 */
export function isMemoryCloudSyncAlarmListenerRegistered(): boolean {
  return registered
}

/** 测试用：重置监听器注册状态（不调用 Chrome remove，需配合 mock）。 */
export function resetMemoryCloudSyncAlarmListenerForTests(): void {
  registered = false
}
