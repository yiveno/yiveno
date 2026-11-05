import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import {
  bulkPutChromeBookmarkLeaves,
  clearChromeBookmarkImportState,
  readChromeBookmarkImportState,
  upsertChromeBookmarkLeaves,
  writeChromeBookmarkImportState
} from '@/application/capture/chrome-bookmark-bulk-import'
import { finalizeChromeBookmarkSyncAfterImport } from '@/application/capture/chrome-bookmark-sync-service'
import { readChromeBookmarkLeaves } from '@/infrastructure/browser/chrome-bookmark-reader'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

let importInFlight: Promise<ChromeBookmarkImportState> | null = null

/** 本 SW 会话是否已调度过「灌库开 → ensure 补洞」（避免 status 轮询重复全量 reconcile）。 */
let ensureHoleHealScheduledThisSwSession = false

/** 读取当前 Chrome 书签导入进度（不触发导入）。 */
export async function getChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportState | null> {
  return readChromeBookmarkImportState()
}

/**
 * 灌库开启时，每 SW 会话最多调度一次 ensure（completed → reconcile；未完成 → 续跑 bulk）。
 * 堵住：Memory 被清空/丢库后 import 仍标 completed、冷启动 ready 早退不再补洞。
 */
export function scheduleEnsureChromeBookmarksImportedIfNeeded(reason: string): void {
  if (ensureHoleHealScheduledThisSwSession) {
    return
  }
  ensureHoleHealScheduledThisSwSession = true
  void (async () => {
    try {
      const settings = await getUserSettings()
      if (!settings.chromeBookmarkIngestEnabled) {
        // 关灌库：允许本会话稍后开启时再调度
        ensureHoleHealScheduledThisSwSession = false
        return
      }
      await ensureChromeBookmarksImported()
      logger.info('ChromeBookmarkImport', '会话级书签补洞 ensure 完成', { reason })
    } catch (error) {
      ensureHoleHealScheduledThisSwSession = false
      logger.warn('ChromeBookmarkImport', '会话级书签补洞 ensure 失败', { reason, error })
    }
  })()
}

/** 清本机记忆时抹掉导入进度，便于重新开启后整树 bulk。 */
export async function resetChromeBookmarkImportAfterLocalClear(): Promise<void> {
  await clearChromeBookmarkImportState()
  ensureHoleHealScheduledThisSwSession = false
  logger.info('ChromeBookmarkImport', '已清除书签导入进度（随清本机记忆）')
}

/** 测试用：重置会话级补洞调度标记。 */
export function resetChromeBookmarkImportHoleHealForTests(): void {
  ensureHoleHealScheduledThisSwSession = false
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

  await writeChromeBookmarkImportState({
    status: 'running',
    importedCount: startOffset,
    totalCount: existing?.totalCount,
    startedAt
  })

  try {
    const leaves = await readChromeBookmarkLeaves()
    totalCount = leaves.length

    await writeChromeBookmarkImportState({
      status: 'running',
      importedCount: startOffset,
      totalCount,
      startedAt
    })

    if (startOffset >= totalCount && totalCount > 0) {
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
    const failed: ChromeBookmarkImportState = {
      status: 'failed',
      importedCount,
      totalCount,
      startedAt,
      errorCode: 'BOOKMARK_IMPORT_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
    await writeChromeBookmarkImportState(failed)
    logger.error('ChromeBookmarkImport', '书签导入失败', error)
    throw error
  }
}
