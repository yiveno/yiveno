/**
 * 浏览记录一次性导入：请求 history 可选权限 → chrome.history.search 游标分页 → upsert。
 * 本地-only；重导入 max 合并；计数永不下降。
 */

import {
  BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY,
  BehaviorHistoryImportStateSchema,
  type BehaviorHistoryImportState
} from '@/core/behavior/behavior-history-import-state'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { behaviorStatsRepository } from '@/infrastructure/indexeddb/behavior-stats-repository'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'
import { logger } from '@/infrastructure/logging/logger'

const HISTORY_BATCH_SIZE = 1000
const HISTORY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
const PROGRESS_WRITE_EVERY = 200

let importInFlight: Promise<BehaviorHistoryImportState> | null = null

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

/** 读取导入状态（不触发导入）。 */
export async function getBehaviorHistoryImportStatus(): Promise<BehaviorHistoryImportState | null> {
  return readChromeStorageLocal(
    BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY,
    BehaviorHistoryImportStateSchema
  )
}

export async function writeBehaviorHistoryImportState(
  state: BehaviorHistoryImportState
): Promise<void> {
  await writeChromeStorageLocal(
    BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY,
    BehaviorHistoryImportStateSchema.parse(state)
  )
}

export async function clearBehaviorHistoryImportState(): Promise<void> {
  await removeChromeStorageLocal(BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY)
}

/**
 * SW 内无用户手势，chrome.permissions.request 恒抛 gesture 错误——
 * 即使权限已授予也一样（2026-11-24 真机实证：contains 为 true 时 request 仍抛）。
 * 因此 SW 侧只做 contains 检查，绝不调 request；授权由 Settings 页点击 handler 内的 request 负责。
 */
export async function requestHistoryPermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ['history'] })
}

/**
 * 启动导入（去重 in-flight）。
 * 权限拒绝 → failed + BEHAVIOR_IMPORT_PERMISSION_DENIED，不写任何行为行。
 */
export async function importBehaviorHistory(): Promise<BehaviorHistoryImportState> {
  if (importInFlight) {
    return importInFlight
  }
  importInFlight = runBehaviorHistoryImport().finally(() => {
    importInFlight = null
  })
  return importInFlight
}

/**
 * 清除当前 owner 行为表 + 导入状态。
 */
export async function clearBehaviorHistoryData(): Promise<{ deleted: number }> {
  const ownerId = await getCurrentOwnerId()
  const deleted = await behaviorStatsRepository.clearByOwner(ownerId)
  await clearBehaviorHistoryImportState()
  logger.info('BehaviorImport', '已清除行为数据与导入状态', { ownerId, deleted })
  return { deleted }
}

async function runBehaviorHistoryImport(): Promise<BehaviorHistoryImportState> {
  const startedAt = new Date().toISOString()
  logger.info('BehaviorImport', '浏览记录导入开始')

  const granted = await requestHistoryPermission()
  if (!granted) {
    const denied: BehaviorHistoryImportState = {
      status: 'failed',
      importedCount: 0,
      skippedCount: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      errorCode: 'BEHAVIOR_IMPORT_PERMISSION_DENIED'
    }
    await writeBehaviorHistoryImportState(denied)
    logger.info('BehaviorImport', '未获得 history 权限，未导入任何记录')
    return denied
  }

  const ownerId = await getCurrentOwnerId()
  const nowMs = Date.now()
  const windowStart = nowMs - HISTORY_WINDOW_MS
  let endTime = nowMs
  let importedCount = 0
  let skippedCount = 0
  let scannedCount = 0

  const running: BehaviorHistoryImportState = {
    status: 'running',
    importedCount: 0,
    skippedCount: 0,
    scannedCount: 0,
    startedAt
  }
  await writeBehaviorHistoryImportState(running)

  try {
    if (!chrome.history?.search) {
      throw new Error('chrome.history.search 不可用')
    }

    while (endTime > windowStart) {
      const batch = await chrome.history.search({
        text: '',
        startTime: windowStart,
        endTime,
        maxResults: HISTORY_BATCH_SIZE
      })
      if (batch.length === 0) {
        break
      }

      let oldestInBatch = endTime
      for (const item of batch) {
        scannedCount += 1
        const url = item.url?.trim()
        const visitCount = item.visitCount ?? 0
        const lastVisitTime = item.lastVisitTime ?? 0
        if (lastVisitTime > 0 && lastVisitTime < oldestInBatch) {
          oldestInBatch = lastVisitTime
        }
        if (!url || visitCount <= 0) {
          skippedCount += 1
          continue
        }
        try {
          const row = await behaviorStatsRepository.upsert({
            ownerId,
            url,
            visitCount,
            lastVisitTime,
            totalDwellMs: 0
          })
          if (row) {
            importedCount += 1
          } else {
            skippedCount += 1
          }
        } catch {
          skippedCount += 1
        }
      }

      if (scannedCount % PROGRESS_WRITE_EVERY < batch.length) {
        await writeBehaviorHistoryImportState({
          status: 'running',
          importedCount,
          skippedCount,
          scannedCount,
          startedAt
        })
        await yieldToEventLoop()
      }

      // 游标：下一批 endTime = 本批最老 lastVisitTime（严格更早，避免死循环）
      if (oldestInBatch >= endTime || batch.length < HISTORY_BATCH_SIZE) {
        if (batch.length < HISTORY_BATCH_SIZE) {
          break
        }
        // 同毫秒撞车：微移
        endTime = oldestInBatch - 1
      } else {
        endTime = oldestInBatch
      }
      if (endTime <= windowStart) {
        break
      }
    }

    const completed: BehaviorHistoryImportState = {
      status: 'completed',
      importedCount,
      skippedCount,
      scannedCount,
      startedAt,
      completedAt: new Date().toISOString()
    }
    await writeBehaviorHistoryImportState(completed)
    logger.info('BehaviorImport', '浏览记录导入完成', {
      importedCount,
      skippedCount,
      scannedCount
    })
    return completed
  } catch (error) {
    const failed: BehaviorHistoryImportState = {
      status: 'failed',
      importedCount,
      skippedCount,
      scannedCount,
      startedAt,
      completedAt: new Date().toISOString(),
      errorCode: 'BEHAVIOR_IMPORT_READ_FAILED',
      error: error instanceof Error ? error.message : String(error)
    }
    await writeBehaviorHistoryImportState(failed)
    logger.warn('BehaviorImport', '浏览记录导入失败', {
      error: failed.error,
      importedCount,
      skippedCount
    })
    return failed
  }
}
