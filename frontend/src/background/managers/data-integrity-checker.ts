/**
 * 数据完整性兜底同步器
 *
 * 职责：
 * - 定期执行全量同步，作为兜底机制
 * - 防止增量同步漏掉某些变更
 * - 简单可靠，无需复杂判断
 *
 * 策略：
 * - 每 24 小时执行一次全量同步
 * - 无条件执行，不做数据对比
 * - 确保数据误差不超过一天
 */

import { logger } from '@/infrastructure/logging/logger'
import { bookmarkSyncService } from '@/infrastructure/services/bookmark-sync-service'

/** Alarm 名称 */
const ALARM_NAME = 'ottersage-daily-sync'

/** 同步间隔（分钟）- 24 小时 */
const SYNC_INTERVAL_MINUTES = 24 * 60

/**
 * 执行定期全量同步
 *
 * 策略：
 * - 无条件执行全量同步
 * - 作为兜底机制，确保数据最终一致性
 * - 简单可靠，无需复杂判断
 */
async function performDailySync(): Promise<void> {
  const syncStart = performance.now()
  logger.info('DailySync', '🔄 开始定期全量同步（兜底任务）...')

  try {
    // 直接执行全量同步，不做任何检查
    await bookmarkSyncService.syncAllBookmarks()

    const totalElapsed = performance.now() - syncStart
    logger.info('DailySync', `✅ 定期全量同步完成，总耗时: ${totalElapsed.toFixed(0)}ms`)
  } catch (error) {
    logger.error('DailySync', '❌ 定期全量同步失败', error)
    // 同步失败不影响正常使用，只记录日志
    // bookmarkSyncService 内部有重试机制
  }
}

/**
 * 初始化定期同步器
 *
 * 注册 chrome.alarms 定时任务
 */
export function initializeDataIntegrityChecker(): void {
  logger.info('DailySync', '🔧 初始化定期同步器...')

  // 1. 清除旧的 Alarm（如果存在）
  chrome.alarms.clear(ALARM_NAME, wasCleared => {
    if (wasCleared) {
      logger.debug('DailySync', '🗑️ 已清除旧的定时任务')
    }
  })

  // 2. 创建新的周期性 Alarm
  // 首次延迟 24 小时，之后每 24 小时执行一次
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: SYNC_INTERVAL_MINUTES,
    periodInMinutes: SYNC_INTERVAL_MINUTES
  })

  logger.info('DailySync', `✅ 定期同步器已启动，同步间隔: ${SYNC_INTERVAL_MINUTES / 60} 小时`)

  // 3. 注册 Alarm 监听器
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) {
      logger.debug('DailySync', '⏰ 定时任务触发，开始同步...')
      // 异步执行，不阻塞 Alarm 处理
      performDailySync().catch(error => {
        logger.error('DailySync', '❌ 定时同步执行失败', error)
      })
    }
  })

  logger.info('DailySync', '✅ Alarm 监听器已注册')
}

/**
 * 手动触发全量同步（用于测试或手动修复）
 *
 * @returns Promise，在同步完成时 resolve
 */
export async function triggerManualCheck(): Promise<void> {
  logger.info('DailySync', '🔧 手动触发全量同步')
  await performDailySync()
}
