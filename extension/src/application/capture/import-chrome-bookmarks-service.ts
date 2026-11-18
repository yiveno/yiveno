import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import {
  bulkPutChromeBookmarkLeaves,
  clearChromeBookmarkImportState,
  readChromeBookmarkImportState,
  upsertChromeBookmarkLeaves,
  writeChromeBookmarkImportState
} from '@/application/capture/chrome-bookmark-bulk-import'
import { finalizeChromeBookmarkSyncAfterImport } from '@/application/capture/chrome-bookmark-sync-service'
import { invalidateBookmarkSyncAlignmentCache } from '@/application/memory/bookmark-sync-alignment-cache'
import { readChromeBookmarkLeaves } from '@/infrastructure/browser/chrome-bookmark-reader'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

let importInFlight: Promise<ChromeBookmarkImportState> | null = null

/**
 * 本 SW 会话是否已对终态（completed / failed）跑过调度 ensure。
 * running / pending / ingest OFF 不置位，便于卡住的 running 被后续 status 读取续跑。
 */
let ensureHoleHealTerminalConsumedThisSwSession = false

/** 调度入口在途去重：同一 tick 多次 schedule 只进一次异步工作。 */
let ensureHoleHealScheduleInFlight = false

/** 当前在途调度 Promise（测试排空用；生产忽略）。 */
let ensureHoleHealSchedulePromise: Promise<void> | null = null

/** 读取当前 Chrome 书签导入进度（不触发导入）。 */
export async function getChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportState | null> {
  return readChromeBookmarkImportState()
}

/**
 * 导入已授权时调度 ensure（completed → finalize；running/pending → 续跑 bulk）。
 * 终态（completed/failed）本会话只自动跑一次；failed 不风暴重试（显式 ENSURE 消息直调 ensure，不受本守卫）。
 * 门仍查 ingest：ingest 开 + sync 关时仍须补洞/续传；finalize 内 reconcile 另受 sync 门禁。
 */
export function scheduleEnsureChromeBookmarksImportedIfNeeded(reason: string): void {
  if (ensureHoleHealScheduleInFlight) {
    return
  }
  ensureHoleHealScheduleInFlight = true
  ensureHoleHealSchedulePromise = (async () => {
    try {
      const settings = await getUserSettings()
      if (!settings.chromeBookmarkIngestEnabled) {
        // 未授权：不置终态标志，稍后授权仍可再调度
        return
      }
      const existing = await readChromeBookmarkImportState()
      if (
        (existing?.status === 'completed' || existing?.status === 'failed') &&
        ensureHoleHealTerminalConsumedThisSwSession
      ) {
        return
      }
      try {
        const state = await ensureChromeBookmarksImported()
        if (state.status === 'completed' || state.status === 'failed') {
          ensureHoleHealTerminalConsumedThisSwSession = true
        }
        logger.info('ChromeBookmarkImport', '会话级书签补洞 ensure 完成', { reason })
      } catch (error) {
        const afterFailure = await readChromeBookmarkImportState()
        if (afterFailure?.status === 'completed' || afterFailure?.status === 'failed') {
          ensureHoleHealTerminalConsumedThisSwSession = true
        }
        logger.warn('ChromeBookmarkImport', '会话级书签补洞 ensure 失败', { reason, error })
      }
    } finally {
      ensureHoleHealScheduleInFlight = false
    }
  })()
}

/** 测试用：排空在途 schedule，避免测间标志竞态。 */
export async function flushScheduledChromeBookmarkEnsureForTests(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    const pending = ensureHoleHealSchedulePromise
    if (!pending && !ensureHoleHealScheduleInFlight) {
      return
    }
    if (pending) {
      await pending
    }
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0)
    })
  }
}

/** 清本机记忆时抹掉导入进度，便于重新开启后整树 bulk。 */
export async function resetChromeBookmarkImportAfterLocalClear(): Promise<void> {
  await clearChromeBookmarkImportState()
  ensureHoleHealTerminalConsumedThisSwSession = false
  logger.info('ChromeBookmarkImport', '已清除书签导入进度（随清本机记忆）')
}

/**
 * 确保 Chrome 书签已导入到 IndexedDB。
 * 首次 bulk putMany；续传 upsert 防重复；完成后跳过。
 */
export async function ensureChromeBookmarksImported(): Promise<ChromeBookmarkImportState> {
  const settings = await getUserSettings()
  if (!settings.chromeBookmarkIngestEnabled) {
    const existing = await readChromeBookmarkImportState()
    logger.info('ChromeBookmarkImport', '用户已关闭书签灌库，跳过 bulk 导入', {
      previousStatus: existing?.status ?? null
    })
    if (existing) {
      return existing
    }
    const skipped: ChromeBookmarkImportState = {
      status: 'pending',
      importedCount: 0,
      startedAt: new Date().toISOString()
    }
    return skipped
  }

  const existing = await readChromeBookmarkImportState()
  if (existing?.status === 'completed') {
    // 已完成后仍 flush + reconcile，堵住 SW 丢事件 / pending 丢失造成的永久缺口
    await finalizeChromeBookmarkSyncAfterImport()
    return existing
  }

  if (importInFlight) {
    return importInFlight
  }

  importInFlight = runChromeBookmarkImport(existing).finally(() => {
    importInFlight = null
  })

  return importInFlight
}

async function runChromeBookmarkImport(
  existing: ChromeBookmarkImportState | null
): Promise<ChromeBookmarkImportState> {
  const startedAt = existing?.startedAt ?? new Date().toISOString()
  const startOffset = existing?.importedCount ?? 0
  let importedCount = startOffset
  let totalCount = existing?.totalCount

  logger.info('ChromeBookmarkImport', '书签 bulk 导入开始', {
    startOffset,
    resume: Boolean(existing && existing.status !== 'completed'),
    previousStatus: existing?.status ?? null
  })

  /** 失败归因阶段：读树 vs 写库（仅影响 errorCode，不改成功路径）。 */
  let failurePhase: 'read' | 'write' = 'read'

  try {
    const leaves = await readChromeBookmarkLeaves()
    totalCount = leaves.length
    failurePhase = 'write'

    // 空树：直接 completed，不写 running、不调 bulk put（UI 最多闪一轮轮询）
    if (totalCount === 0) {
      const completed: ChromeBookmarkImportState = {
        status: 'completed',
        importedCount: 0,
        totalCount: 0,
        startedAt,
        completedAt: new Date().toISOString()
      }
      await writeChromeBookmarkImportState(completed)
      await finalizeChromeBookmarkSyncAfterImport()
      logger.info('ChromeBookmarkImport', '书签 bulk 导入已完成（空树 fast-path）', {
        importedCount: 0,
        totalCount: 0
      })
      return completed
    }

    await writeChromeBookmarkImportState({
      status: 'running',
      importedCount: startOffset,
      totalCount,
      startedAt
    })

    if (startOffset >= totalCount) {
      const completed: ChromeBookmarkImportState = {
        status: 'completed',
        importedCount: totalCount,
        totalCount,
        startedAt,
        completedAt: new Date().toISOString()
      }
      await writeChromeBookmarkImportState(completed)
      await finalizeChromeBookmarkSyncAfterImport()
      logger.info('ChromeBookmarkImport', '书签 bulk 导入已完成（空续传早退）', {
        importedCount: totalCount,
        totalCount
      })
      return completed
    }

    const onProgress = async (count: number) => {
      importedCount = count
      await writeChromeBookmarkImportState({
        status: 'running',
        importedCount: count,
        totalCount,
        startedAt
      })
      await yieldToEventLoop()
    }

    if (startOffset > 0) {
      importedCount = await upsertChromeBookmarkLeaves(leaves, startOffset, onProgress)
    } else {
      importedCount = await bulkPutChromeBookmarkLeaves(leaves, 0, onProgress)
    }

    // 写阶段已落库：失效对齐缓存，避免 Library「未进入记忆」要重载扩展才更新
    invalidateBookmarkSyncAlignmentCache()

    const completed: ChromeBookmarkImportState = {
      status: 'completed',
      importedCount,
      totalCount,
      startedAt,
      completedAt: new Date().toISOString()
    }
    await writeChromeBookmarkImportState(completed)

    await finalizeChromeBookmarkSyncAfterImport()

    logger.info('ChromeBookmarkImport', '书签 bulk 导入完成', {
      importedCount,
      totalCount
    })

    return completed
  } catch (error) {
    // 失败前可能已有部分 batch 写入，同样失效
    if (failurePhase === 'write') {
      invalidateBookmarkSyncAlignmentCache()
    }
    const errorCode =
      failurePhase === 'read' ? 'BOOKMARK_IMPORT_READ_FAILED' : 'BOOKMARK_IMPORT_WRITE_FAILED'
    const failed: ChromeBookmarkImportState = {
      status: 'failed',
      importedCount,
      totalCount,
      startedAt,
      errorCode,
      ...(error instanceof Error ? { error: error.message } : {})
    }
    await writeChromeBookmarkImportState(failed)
    logger.error('ChromeBookmarkImport', '书签导入失败', { errorCode, error })
    throw error
  }
}
