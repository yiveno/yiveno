/**
 * Chrome 书签 ↔ Memory 定时 full repair 闹钟。
 * 仅在书签灌库开启时挂周期任务；关闭则清除。
 */

import { logger } from '@/infrastructure/logging/logger'

/** 闹钟名（稳定，可过滤）。 */
export const CHROME_BOOKMARK_REPAIR_ALARM_NAME = 'yiveno.chrome_bookmark_repair' as const

/**
 * 周期（分钟）。每日一次全量对账；增量仍靠 bookmarks.on*。
 * Chrome MV3 周期闹钟最小 1。
 */
export const CHROME_BOOKMARK_REPAIR_PERIOD_MINUTES = 24 * 60

/** 按灌库开关创建或清除每日对账闹钟。 */
export async function ensureChromeBookmarkRepairAlarm(enabled: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('ChromeBookmarkSync', 'chrome.alarms 不可用，跳过书签对账闹钟挂载', { enabled })
    return
  }

  if (!enabled) {
    await chrome.alarms.clear(CHROME_BOOKMARK_REPAIR_ALARM_NAME)
    logger.info('ChromeBookmarkSync', '已清除书签每日对账闹钟')
    return
  }

  await chrome.alarms.create(CHROME_BOOKMARK_REPAIR_ALARM_NAME, {
    periodInMinutes: CHROME_BOOKMARK_REPAIR_PERIOD_MINUTES
  })
  logger.info('ChromeBookmarkSync', '已挂载书签每日对账闹钟', {
    periodInMinutes: CHROME_BOOKMARK_REPAIR_PERIOD_MINUTES
  })
}
