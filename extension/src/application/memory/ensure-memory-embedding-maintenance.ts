/**
 * 无感 embedding 维护（用户无 UI）。
 * 摘录优先同步写回，再异步补缺口；由 bootstrap / 登录 / 书签 sync 后调度。
 */

import {
  backfillMissingMemoryEmbeddings,
  enqueueMissingMemoryEmbeddings,
  type MemoryEmbedBackfillResult
} from '@/application/memory/schedule-async-memory-embedding'
import { logger } from '@/infrastructure/logging/logger'

/** 默认延迟：避开启动尖峰与 enrichment 抢配额。 */
export const EMBEDDING_MAINTENANCE_DEFAULT_DELAY_MS = 2800

/** 书签 sync finalize 清队列后再补；给 reconcile 收尾留空隙。 */
export const EMBEDDING_MAINTENANCE_AFTER_SYNC_DELAY_MS = 3500

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let scheduleGeneration = 0
let inFlight: Promise<MemoryEmbedBackfillResult | null> | null = null

/**
 * 防抖调度无感维护（多次触发合并为最后一次）。
 */
export function scheduleSilentMemoryEmbeddingMaintenance(
  reason: string,
  delayMs = EMBEDDING_MAINTENANCE_DEFAULT_DELAY_MS
): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const generation = ++scheduleGeneration
  logger.info('MemoryEmbed', '已调度无感 embedding 维护', { reason, delayMs })
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (generation !== scheduleGeneration) {
      return
    }
    void runSilentMemoryEmbeddingMaintenance(reason)
  }, delayMs)
}

/**
 * 立即执行（或并入进行中的任务）：先同步回填摘录，再异步入队剩余缺口。
 */
export async function runSilentMemoryEmbeddingMaintenance(
  reason: string
): Promise<MemoryEmbedBackfillResult | null> {
  if (inFlight) {
    logger.info('MemoryEmbed', '无感 embedding 维护合并到进行中任务', { reason })
    return inFlight
  }

  inFlight = (async () => {
    logger.info('MemoryEmbed', '无感 embedding 维护开始', { reason })
    try {
      // 同步写摘录：不被 sync finalize 清队列打断
      const excerptResult = await backfillMissingMemoryEmbeddings()
      // 再入队补书签等缺口（可被下次 sync 清空，但摘录已落盘）
      const enqueueResult = await enqueueMissingMemoryEmbeddings()
      logger.info('MemoryEmbed', '无感 embedding 维护结束', {
        reason,
        excerptWritten: excerptResult.written,
        excerptFailed: excerptResult.failed,
        excerptAttempted: excerptResult.attempted,
        quotaHit: excerptResult.quotaHit,
        enqueued: enqueueResult.enqueued,
        scanned: enqueueResult.scanned
      })
      return excerptResult
    } catch (error) {
      logger.error('MemoryEmbed', '无感 embedding 维护失败（下次启动/登录/sync 后重试）', error)
      return null
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/** 测试用：取消定时器并重置单飞状态。 */
export function resetSilentMemoryEmbeddingMaintenanceForTests(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  scheduleGeneration += 1
  inFlight = null
}
