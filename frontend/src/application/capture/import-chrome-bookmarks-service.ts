import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import {
  bulkPutChromeBookmarkLeaves,
  readChromeBookmarkImportState,
  upsertChromeBookmarkLeaves,
  writeChromeBookmarkImportState
} from '@/application/capture/chrome-bookmark-bulk-import'
import { flushPendingChromeBookmarkSync } from '@/application/capture/chrome-bookmark-sync-service'
import { readChromeBookmarkLeaves } from '@/infrastructure/browser/chrome-bookmark-reader'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

let importInFlight: Promise<ChromeBookmarkImportState> | null = null

/** 读取当前 Chrome 书签导入进度（不触发导入）。 */
export async function getChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportState | null> {
  return readChromeBookmarkImportState()
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

    await flushPendingChromeBookmarkSync()

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
