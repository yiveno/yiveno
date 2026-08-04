/**
 * 云 Memory 定时同步闹钟（chrome.alarms）。
 * 仅在 syncPrefs.enabled 时挂周期任务；关闭同步则清掉。
 */

import { logger } from '@/infrastructure/logging/logger'

/** 闹钟名（稳定，可过滤）。 */
export const MEMORY_CLOUD_SYNC_ALARM_NAME = 'yiveno.memory_cloud_sync' as const

/**
 * 周期（分钟）。Chrome MV3 周期闹钟最小 1；15 分钟平衡电量与新鲜度。
 */
export const MEMORY_CLOUD_SYNC_PERIOD_MINUTES = 15 as const

/** 按开关创建或清除周期闹钟。 */
export async function ensureMemoryCloudSyncAlarm(enabled: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('MemorySync', 'chrome.alarms 不可用，跳过定时同步挂载', { enabled })
    return
  }

  if (!enabled) {
    await chrome.alarms.clear(MEMORY_CLOUD_SYNC_ALARM_NAME)
    logger.info('MemorySync', '已清除云同步定时闹钟')
    return
  }

  await chrome.alarms.create(MEMORY_CLOUD_SYNC_ALARM_NAME, {
    periodInMinutes: MEMORY_CLOUD_SYNC_PERIOD_MINUTES
  })
  logger.info('MemorySync', '已挂载云同步定时闹钟', {
    periodInMinutes: MEMORY_CLOUD_SYNC_PERIOD_MINUTES
  })
}
