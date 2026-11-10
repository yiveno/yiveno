/**
 * Dreaming 夜间批处理闹钟（chrome.alarms）。
 * 周期从创建时刻起计，无固定墙钟；浏览器关闭时不触发。
 */

import {
  DREAMING_ALARM_NAME,
  DREAMING_ALARM_PERIOD_MINUTES
} from '@/core/dreaming/dreaming-constants'
import { logger } from '@/infrastructure/logging/logger'

export { DREAMING_ALARM_NAME, DREAMING_ALARM_PERIOD_MINUTES }

/** 创建或清除每日 dreaming 周期闹钟。 */
export async function ensureDreamingAlarm(enabled: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('Dreaming', 'chrome.alarms 不可用，跳过 dreaming 闹钟挂载', { enabled })
    return
  }

  if (!enabled) {
    await chrome.alarms.clear(DREAMING_ALARM_NAME)
    logger.info('Dreaming', '已清除 dreaming 定时闹钟')
    return
  }

  await chrome.alarms.create(DREAMING_ALARM_NAME, {
    periodInMinutes: DREAMING_ALARM_PERIOD_MINUTES
  })
  logger.info('Dreaming', '已挂载 dreaming 定时闹钟', {
    periodInMinutes: DREAMING_ALARM_PERIOD_MINUTES,
    wallClock: 'none（自创建起每 1440 分钟）'
  })
}
