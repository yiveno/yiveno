import {
  countBookmarkLibraryLeaves,
  mapChromeBookmarkTreeToLibraryForest,
  type ChromeBookmarkTreeInput
} from '@/core/memory/bookmark-library-tree'
import type { GetBookmarkLibraryTreeResponse } from '@/core/messaging/import-messages'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { getChromeBookmarkImportStatus } from '@/application/capture/import-chrome-bookmarks-service'
import type { ChromeBookmarkImportStatusResponse } from '@/core/messaging/import-messages'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

/** 返回 Chrome 书签导入进度。 */
export async function handleGetChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportStatusResponse> {
  try {
    const state = await getChromeBookmarkImportStatus()
    return { ok: true, state }
  } catch (error) {
    logger.error('Background', '读取书签导入状态失败', error)
    return {
      ok: false,
      errorCode: 'IMPORT_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

function toChromeTreeInput(node: chrome.bookmarks.BookmarkTreeNode): ChromeBookmarkTreeInput {
  return {
    id: node.id,
    ...(node.title !== undefined ? { title: node.title } : {}),
    ...(node.url !== undefined ? { url: node.url } : {}),
    ...(node.children ? { children: node.children.map(child => toChromeTreeInput(child)) } : {})
  }
}

/** 读取 Chrome 书签目录树并与 Memory 书签对齐（只读）。 */
export async function handleGetBookmarkLibraryTree(): Promise<GetBookmarkLibraryTreeResponse> {
  try {
    const [chromeTree, memoryBookmarks] = await Promise.all([
      chrome.bookmarks.getTree(),
      memoryItemService.list({ type: 'bookmark', limit: 500 })
    ])

    const memoryIdByChromeBookmarkId = new Map<string, string>()
    for (const item of memoryBookmarks) {
      if (item.type !== 'bookmark') {
        continue
      }
      const chromeId = item.payload.chromeBookmarkId
      if (chromeId) {
        memoryIdByChromeBookmarkId.set(chromeId, item.id)
      }
    }

    const roots = mapChromeBookmarkTreeToLibraryForest(
      chromeTree.map(node => toChromeTreeInput(node)),
      memoryIdByChromeBookmarkId,
      { unnamedFolderTitle: t('library_folder_unnamed') }
    )

    return {
      ok: true,
      roots,
      bookmarkCount: countBookmarkLibraryLeaves(roots)
    }
  } catch (error) {
    logger.error('Background', '读取书签目录树失败', error)
    return {
      ok: false,
      errorCode: 'LIBRARY_TREE_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
