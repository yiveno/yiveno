/**
 * 注册书签每日 full repair 闹钟监听：对账 IndexedDB ↔ Chrome。
 */

import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import {
  isChromeBookmarkIngestEnabled,
  repairChromeBookmarksWithMemory
} from '@/application/capture/chrome-bookmark-sync-service'
import {
  CHROME_BOOKMARK_REPAIR_ALARM_NAME,
  ensureChromeBookmarkRepairAlarm
} from '@/infrastructure/sync/chrome-bookmark-repair-alarm'
import { logger } from '@/infrastructure/logging/logger'

let registered = false

/** 对账写 IDB 前须等 bootstrap（SW 禁止动态 import）。 */
async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

/** 注册 alarms.onAlarm；启动时按灌库开关对齐闹钟。 */
export function registerChromeBookmarkRepairAlarmListener(): void {
  if (registered) {
    return
  }
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('ChromeBookmarkSync', '无法注册书签对账闹钟：chrome.alarms 不可用')
    return
  }

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== CHROME_BOOKMARK_REPAIR_ALARM_NAME) {
      return
    }
    void ensureBootstrapReady()
      .then(async () => {
        if (!(await isChromeBookmarkIngestEnabled())) {
          await ensureChromeBookmarkRepairAlarm(false)
          logger.info('ChromeBookmarkSync', '定时对账已跳过（灌库已关，并清除闹钟）')
          return
        }
        // force：不受「本 SW 会话已跑过」限制，保证每日真正对账
        const result = await repairChromeBookmarksWithMemory({ force: true })
        if (result.skipped) {
          logger.info('ChromeBookmarkSync', '定时对账已跳过', {
            reason: result.reason ?? null
          })
          return
        }
        logger.info('ChromeBookmarkSync', '定时对账完成', {
          upserted: result.upserted,
          softDeleted: result.softDeleted
        })
      })
      .catch(error => {
        logger.error('ChromeBookmarkSync', '定时对账异常', error)
      })
  })

  registered = true
  logger.info('ChromeBookmarkSync', '书签每日对账闹钟监听已注册')

  void isChromeBookmarkIngestEnabled()
    .then(enabled => ensureChromeBookmarkRepairAlarm(enabled))
    .catch(error => {
      logger.warn('ChromeBookmarkSync', '启动时对齐书签对账闹钟失败', error)
    })
}
