import { readChromeBookmarkImportState } from '@/application/capture/chrome-bookmark-bulk-import'
import {
  EMBEDDING_MAINTENANCE_AFTER_SYNC_DELAY_MS,
  scheduleSilentMemoryEmbeddingMaintenance
} from '@/application/memory/ensure-memory-embedding-maintenance'
import { clearAsyncMemoryEmbeddingQueue } from '@/application/memory/schedule-async-memory-embedding'
import { clearAsyncMemoryLlmEnrichmentQueue } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { invalidateBookmarkSyncAlignmentCache } from '@/application/memory/bookmark-sync-alignment-cache'
import {
  isIndexedDbQuotaExceededError,
  isIndexedDbWriteQuotaExhausted,
  markIndexedDbWriteQuotaExhausted,
  resetIndexedDbWriteQuotaExhaustedForTests
} from '@/application/memory/indexeddb-write-quota'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY,
  ChromeBookmarkSyncPendingSchema,
  type ChromeBookmarkSyncPending
} from '@/core/memory/chrome-bookmark-sync-pending'
import {
  readChromeBookmarkById,
  readChromeBookmarkLeaves,
  toChromeBookmarkLeaf,
  type ChromeBookmarkLeaf
} from '@/infrastructure/browser/chrome-bookmark-reader'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'
import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

const pendingUpsertIds = new Set<string>()
const pendingRemoveIds = new Set<string>()

/** 是否已从 session 灌入过 pending（避免覆盖未 hydrate 的持久队列）。 */
let pendingHydrated = false
let pendingHydratePromise: Promise<void> | null = null

/** 用户是否允许书签灌库（Settings）。 */
export async function isChromeBookmarkIngestEnabled(): Promise<boolean> {
  const settings = await getUserSettings()
  return settings.chromeBookmarkIngestEnabled
}

/** 增量同步是否已启用（灌库开 + 全量导入完成）。 */
export async function isChromeBookmarkIncrementalSyncEnabled(): Promise<boolean> {
  if (!(await isChromeBookmarkIngestEnabled())) {
    return false
  }
  const state = await readChromeBookmarkImportState()
  return state?.status === 'completed'
}

function snapshotPending(): ChromeBookmarkSyncPending {
  return {
    upsertIds: [...pendingUpsertIds],
    removeIds: [...pendingRemoveIds]
  }
}

async function persistPendingQueue(): Promise<void> {
  const snapshot = snapshotPending()
  if (snapshot.upsertIds.length === 0 && snapshot.removeIds.length === 0) {
    await removeChromeStorageSession(CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY)
    return
  }
  await writeChromeStorageSession(CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY, snapshot)
}

async function ensurePendingHydrated(): Promise<void> {
  if (pendingHydrated) {
    return
  }
  if (!pendingHydratePromise) {
    pendingHydratePromise = (async () => {
      const stored = await readChromeStorageSession(
        CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY,
        ChromeBookmarkSyncPendingSchema
      )
      if (stored) {
        for (const id of stored.upsertIds) {
          pendingRemoveIds.delete(id)
          pendingUpsertIds.add(id)
        }
        for (const id of stored.removeIds) {
          pendingUpsertIds.delete(id)
          pendingRemoveIds.add(id)
        }
        logger.info('ChromeBookmarkSync', '已从 session 恢复 pending', {
          upsertCount: stored.upsertIds.length,
          removeCount: stored.removeIds.length
        })
      }
      pendingHydrated = true
    })().catch(error => {
      pendingHydratePromise = null
      logger.error('ChromeBookmarkSync', '恢复 pending 失败', error)
      throw error
    })
  }
  await pendingHydratePromise
}

async function enqueueUpsert(chromeBookmarkId: string): Promise<void> {
  await ensurePendingHydrated()
  pendingRemoveIds.delete(chromeBookmarkId)
  pendingUpsertIds.add(chromeBookmarkId)
  await persistPendingQueue()
}

async function enqueueRemove(chromeBookmarkId: string): Promise<void> {
  await ensurePendingHydrated()
  pendingUpsertIds.delete(chromeBookmarkId)
  pendingRemoveIds.add(chromeBookmarkId)
  await persistPendingQueue()
}

function leafToUpsertInput(leaf: ChromeBookmarkLeaf) {
  return {
    payload: {
      title: leaf.title,
      url: leaf.url,
      chromeBookmarkId: leaf.chromeBookmarkId,
      parentFolderId: leaf.parentFolderId,
      chromeCreatedAt: leaf.chromeCreatedAt
    },
    captureEntry: 'sync' as const
  }
}

/** 将 Chrome 书签节点同步到 IndexedDB（upsert 或软删）。返回是否写入可找回书签。 */
export async function syncChromeBookmarkNode(
  node: chrome.bookmarks.BookmarkTreeNode
): Promise<{ captured: boolean }> {
  const leaf = toChromeBookmarkLeaf(node)
  if (!leaf) {
    await memoryItemService.softDeleteByChromeBookmarkId(node.id)
    invalidateBookmarkSyncAlignmentCache()
    return { captured: false }
  }

  await memoryItemService.upsertBookmarkFromChrome(leafToUpsertInput(leaf))
  invalidateBookmarkSyncAlignmentCache()
  return { captured: true }
}

/** Chrome 书签被删除时同步软删 MemoryItem。 */
export async function syncChromeBookmarkRemoved(chromeBookmarkId: string): Promise<void> {
  await memoryItemService.softDeleteByChromeBookmarkId(chromeBookmarkId)
  invalidateBookmarkSyncAlignmentCache()
}

/**
 * 处理 Chrome bookmarks.onCreated。
 * @returns captured 为 true 时表示已写入 http(s) 书签记忆（可闪 +1 角标）。
 */
export async function handleChromeBookmarkCreated(
  node: chrome.bookmarks.BookmarkTreeNode
): Promise<{ captured: boolean }> {
  if (!(await isChromeBookmarkIngestEnabled())) {
    logger.info('ChromeBookmarkSync', 'created 已跳过（用户关闭书签灌库）', {
      chromeBookmarkId: node.id
    })
    return { captured: false }
  }

  if (!(await isChromeBookmarkIncrementalSyncEnabled())) {
    await enqueueUpsert(node.id)
    logger.info('ChromeBookmarkSync', 'created 已入队（导入未完成）', {
      chromeBookmarkId: node.id
    })
    return { captured: false }
  }

  const result = await syncChromeBookmarkNode(node)
  logger.info('ChromeBookmarkSync', 'created 已处理', {
    chromeBookmarkId: node.id,
    captured: result.captured
  })
  return result
}

/** 处理 Chrome bookmarks.onChanged。 */
export async function handleChromeBookmarkChanged(chromeBookmarkId: string): Promise<void> {
  if (!(await isChromeBookmarkIngestEnabled())) {
    logger.info('ChromeBookmarkSync', 'changed 已跳过（用户关闭书签灌库）', { chromeBookmarkId })
    return
  }

  if (!(await isChromeBookmarkIncrementalSyncEnabled())) {
    await enqueueUpsert(chromeBookmarkId)
    logger.info('ChromeBookmarkSync', 'changed 已入队（导入未完成）', { chromeBookmarkId })
    return
  }

  const node = await readChromeBookmarkById(chromeBookmarkId)
  if (!node) {
    await syncChromeBookmarkRemoved(chromeBookmarkId)
    logger.info('ChromeBookmarkSync', 'changed → 节点消失，已软删', { chromeBookmarkId })
    return
  }

  const result = await syncChromeBookmarkNode(node)
  logger.info('ChromeBookmarkSync', 'changed 已处理', {
    chromeBookmarkId,
    captured: result.captured
  })
}

/** 处理 Chrome bookmarks.onRemoved。 */
export async function handleChromeBookmarkRemoved(chromeBookmarkId: string): Promise<void> {
  if (!(await isChromeBookmarkIngestEnabled())) {
    logger.info('ChromeBookmarkSync', 'removed 已跳过（用户关闭书签灌库）', { chromeBookmarkId })
    return
  }

  if (!(await isChromeBookmarkIncrementalSyncEnabled())) {
    await enqueueRemove(chromeBookmarkId)
    logger.info('ChromeBookmarkSync', 'removed 已入队（导入未完成）', { chromeBookmarkId })
    return
  }

  await syncChromeBookmarkRemoved(chromeBookmarkId)
  logger.info('ChromeBookmarkSync', 'removed 已软删', { chromeBookmarkId })
}

/**
 * 冲刷积压的增量事件（内存 + session）。
 * 全量导入完成、启动补洞前调用。
 */
export async function flushPendingChromeBookmarkSync(): Promise<void> {
  await ensurePendingHydrated()

  if (isIndexedDbWriteQuotaExhausted()) {
    logger.warn('ChromeBookmarkSync', '冲刷 pending 已跳过（本会话 IndexedDB 配额已耗尽）')
    return
  }

  const removeIds = [...pendingRemoveIds]
  const upsertIds = [...pendingUpsertIds]
  logger.info('ChromeBookmarkSync', '冲刷 pending 开始', {
    removeCount: removeIds.length,
    upsertCount: upsertIds.length
  })

  pendingRemoveIds.clear()
  pendingUpsertIds.clear()
  await persistPendingQueue()

  for (const chromeBookmarkId of removeIds) {
    try {
      await syncChromeBookmarkRemoved(chromeBookmarkId)
    } catch (error) {
      logger.error('ChromeBookmarkSync', '冲刷删除事件失败', { chromeBookmarkId, error })
    }
  }

  for (let index = 0; index < upsertIds.length; index += 1) {
    const chromeBookmarkId = upsertIds[index]
    if (!chromeBookmarkId || removeIds.includes(chromeBookmarkId)) {
      continue
    }

    try {
      const node = await readChromeBookmarkById(chromeBookmarkId)
      if (!node) {
        await syncChromeBookmarkRemoved(chromeBookmarkId)
        continue
      }
      await syncChromeBookmarkNode(node)
    } catch (error) {
      if (isIndexedDbQuotaExceededError(error)) {
        for (let rest = index; rest < upsertIds.length; rest += 1) {
          const remainingId = upsertIds[rest]
          if (remainingId && !removeIds.includes(remainingId)) {
            pendingUpsertIds.add(remainingId)
          }
        }
        await persistPendingQueue()
        markIndexedDbWriteQuotaExhausted('chrome_bookmark_flush')
        logger.error('ChromeBookmarkSync', '冲刷因 IndexedDB 配额耗尽中止，后续本会话不再灌库', {
          chromeBookmarkId,
          remainingUpserts: upsertIds.length - index
        })
        break
      }
      logger.error('ChromeBookmarkSync', '冲刷 upsert 事件失败', { chromeBookmarkId, error })
    }
  }

  logger.info('ChromeBookmarkSync', '冲刷 pending 完成')
}

/**
 * 按 chromeBookmarkId 对齐：Chrome 有、Memory 无的叶子补 upsert。
 * 用于堵住 SW 丢事件 / pending 丢失后的永久缺口；不主动软删孤儿 Memory。
 */
export async function reconcileChromeBookmarksWithMemory(): Promise<{
  upserted: number
  skipped: boolean
}> {
  if (!(await isChromeBookmarkIngestEnabled())) {
    logger.info('ChromeBookmarkSync', 'reconcile 已跳过（用户关闭书签灌库）')
    return { upserted: 0, skipped: true }
  }

  const importState = await readChromeBookmarkImportState()
  if (importState?.status !== 'completed') {
    logger.info('ChromeBookmarkSync', 'reconcile 已跳过（导入未完成）', {
      importStatus: importState?.status ?? null
    })
    return { upserted: 0, skipped: true }
  }

  if (isIndexedDbWriteQuotaExhausted()) {
    logger.warn('ChromeBookmarkSync', 'reconcile 已跳过（本会话 IndexedDB 配额已耗尽）')
    return { upserted: 0, skipped: true }
  }

  logger.info('ChromeBookmarkSync', 'reconcile 开始')
  const leaves = await readChromeBookmarkLeaves()
  const alignment = await memoryItemService.listBookmarkSyncAlignment()
  let upserted = 0

  for (let index = 0; index < leaves.length; index += 1) {
    const leaf = leaves[index]
    if (!leaf || alignment.byChromeBookmarkId.has(leaf.chromeBookmarkId)) {
      continue
    }
    try {
      await memoryItemService.upsertBookmarkFromChrome(leafToUpsertInput(leaf))
      upserted += 1
    } catch (error) {
      if (isIndexedDbQuotaExceededError(error)) {
        markIndexedDbWriteQuotaExhausted('chrome_bookmark_reconcile')
        logger.error(
          'ChromeBookmarkSync',
          'reconcile 因 IndexedDB 配额耗尽中止，后续本会话不再灌库',
          {
            chromeBookmarkId: leaf.chromeBookmarkId,
            skippedRemaining: leaves.length - index - 1,
            leafCount: leaves.length
          }
        )
        break
      }
      logger.error('ChromeBookmarkSync', 'reconcile upsert 失败', {
        chromeBookmarkId: leaf.chromeBookmarkId,
        error
      })
    }
  }

  logger.info('ChromeBookmarkSync', 'reconcile 完成', {
    leafCount: leaves.length,
    upserted,
    quotaExhausted: isIndexedDbWriteQuotaExhausted()
  })
  return { upserted, skipped: false }
}

/**
 * 导入完成或启动时：先 flush pending，再 reconcile 补洞。
 * 仅 Background 调用。
 * 开始前清空 AI 队列，防止历史误入队的万级书签任务继续打 Worker；
 * 结束后调度无感 embedding 维护（摘录优先），用户无需点 Rebuild。
 */
export async function finalizeChromeBookmarkSyncAfterImport(): Promise<void> {
  clearAsyncMemoryLlmEnrichmentQueue('chrome_bookmark_sync_finalize')
  clearAsyncMemoryEmbeddingQueue('chrome_bookmark_sync_finalize')
  await flushPendingChromeBookmarkSync()
  await reconcileChromeBookmarksWithMemory()
  scheduleSilentMemoryEmbeddingMaintenance(
    'chrome_bookmark_sync_finalize',
    EMBEDDING_MAINTENANCE_AFTER_SYNC_DELAY_MS
  )
}

/** 测试用：重置 pending 队列与 hydrate 状态。 */
export function resetPendingChromeBookmarkSyncForTests(): void {
  pendingUpsertIds.clear()
  pendingRemoveIds.clear()
  pendingHydrated = false
  pendingHydratePromise = null
  resetIndexedDbWriteQuotaExhaustedForTests()
}

export { isIndexedDbQuotaExceededError }
