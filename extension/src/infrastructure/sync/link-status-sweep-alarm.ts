/**
 * 死链巡检周期闹钟（chrome.alarms）。
 * 独立闹钟；周期从创建时刻起计，无固定墙钟。
 */

import {
  LINK_STATUS_SWEEP_ALARM_NAME,
  LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES
} from '@/core/dreaming/dreaming-constants'
import { logger } from '@/infrastructure/logging/logger'

export { LINK_STATUS_SWEEP_ALARM_NAME, LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES }

/**
 * 按开关创建或清除每周巡检闹钟。
 * 开关关：清闹钟（不挂空跑）。
 */
export async function ensureLinkStatusSweepAlarm(enabled: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('Dreaming', 'chrome.alarms 不可用，跳过死链巡检闹钟', { enabled })
    return
  }

  if (!enabled) {
    await chrome.alarms.clear(LINK_STATUS_SWEEP_ALARM_NAME)
    logger.info('Dreaming', '已清除死链巡检闹钟')
    return
  }

  await chrome.alarms.create(LINK_STATUS_SWEEP_ALARM_NAME, {
    periodInMinutes: LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES
  })
  logger.info('Dreaming', '已挂载死链巡检闹钟', {
    periodInMinutes: LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES,
    wallClock: 'none（自创建起每 10080 分钟）'
  })
}
