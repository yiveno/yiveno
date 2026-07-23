import { readChromeBookmarkImportState } from '@/application/capture/chrome-bookmark-bulk-import'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  readChromeBookmarkById,
  toChromeBookmarkLeaf,
  type ChromeBookmarkLeaf
} from '@/infrastructure/browser/chrome-bookmark-reader'
import { logger } from '@/infrastructure/logging/logger'

const pendingUpsertIds = new Set<string>()
const pendingRemoveIds = new Set<string>()

/** 增量同步是否已启用（全量导入完成后）。 */
export async function isChromeBookmarkIncrementalSyncEnabled(): Promise<boolean> {
  const state = await readChromeBookmarkImportState()
  return state?.status === 'completed'
}

function enqueueUpsert(chromeBookmarkId: string): void {
  pendingRemoveIds.delete(chromeBookmarkId)
  pendingUpsertIds.add(chromeBookmarkId)
}

function enqueueRemove(chromeBookmarkId: string): void {
  pendingUpsertIds.delete(chromeBookmarkId)
  pendingRemoveIds.add(chromeBookmarkId)
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

/** 将 Chrome 书签节点同步到 IndexedDB（upsert 或软删）。 */
export async function syncChromeBookmarkNode(
  node: chrome.bookmarks.BookmarkTreeNode
): Promise<void> {
  const leaf = toChromeBookmarkLeaf(node)
  if (!leaf) {
    await memoryItemService.softDeleteByChromeBookmarkId(node.id)
    return
  }

  await memoryItemService.upsertBookmarkFromChrome(leafToUpsertInput(leaf))
}

/** Chrome 书签被删除时同步软删 MemoryItem。 */
export async function syncChromeBookmarkRemoved(chromeBookmarkId: string): Promise<void> {
  await memoryItemService.softDeleteByChromeBookmarkId(chromeBookmarkId)
}

/** 处理 Chrome bookmarks.onCreated。 */
export async function handleChromeBookmarkCreated(
  node: chrome.bookmarks.BookmarkTreeNode
): Promise<void> {
  if (!(await isChromeBookmarkIncrementalSyncEnabled())) {
    enqueueUpsert(node.id)
    return
  }

  await syncChromeBookmarkNode(node)
}

/** 处理 Chrome bookmarks.onChanged。 */
export async function handleChromeBookmarkChanged(chromeBookmarkId: string): Promise<void> {
  if (!(await isChromeBookmarkIncrementalSyncEnabled())) {
    enqueueUpsert(chromeBookmarkId)
    return
  }

  const node = await readChromeBookmarkById(chromeBookmarkId)
  if (!node) {
    await syncChromeBookmarkRemoved(chromeBookmarkId)
    return
  }

  await syncChromeBookmarkNode(node)
}

/** 处理 Chrome bookmarks.onRemoved。 */
export async function handleChromeBookmarkRemoved(chromeBookmarkId: string): Promise<void> {
  if (!(await isChromeBookmarkIncrementalSyncEnabled())) {
    enqueueRemove(chromeBookmarkId)
    return
  }

  await syncChromeBookmarkRemoved(chromeBookmarkId)
}

/**
 * 全量导入完成后冲刷导入期间积压的增量事件。
 * 仅 Background 调用。
 */
export async function flushPendingChromeBookmarkSync(): Promise<void> {
  const removeIds = [...pendingRemoveIds]
  pendingRemoveIds.clear()

  for (const chromeBookmarkId of removeIds) {
    try {
      await syncChromeBookmarkRemoved(chromeBookmarkId)
    } catch (error) {
      logger.error('ChromeBookmarkSync', '冲刷删除事件失败', { chromeBookmarkId, error })
    }
  }

  const upsertIds = [...pendingUpsertIds]
  pendingUpsertIds.clear()

  for (const chromeBookmarkId of upsertIds) {
    if (removeIds.includes(chromeBookmarkId)) {
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
      logger.error('ChromeBookmarkSync', '冲刷 upsert 事件失败', { chromeBookmarkId, error })
    }
  }
}

/** 测试用：重置 pending 队列。 */
export function resetPendingChromeBookmarkSyncForTests(): void {
  pendingUpsertIds.clear()
  pendingRemoveIds.clear()
}
