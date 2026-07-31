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
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** 返回 Chrome 书签导入进度。 */
export async function handleGetChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportStatusResponse> {
  const startedAt = flowStart('Import', '读取书签导入状态')
  try {
    const state = await getChromeBookmarkImportStatus()
    flowOk('Import', '读取书签导入状态', startedAt, {
      status: state?.status ?? null,
      importedCount: state?.importedCount ?? null,
      totalCount: state?.totalCount ?? null
    })
    return { ok: true, state }
  } catch (error) {
    flowFail('Import', '读取书签导入状态', startedAt, error)
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
  const startedAt = flowStart('Import', '读取书签目录树')
  try {
    const [chromeTree, alignment, importState] = await Promise.all([
      chrome.bookmarks.getTree(),
      memoryItemService.listBookmarkSyncAlignment(),
      getChromeBookmarkImportStatus()
    ])

    const roots = mapChromeBookmarkTreeToLibraryForest(
      chromeTree.map(node => toChromeTreeInput(node)),
      alignment.byChromeBookmarkId,
      {
        unnamedFolderTitle: t('library_folder_unnamed'),
        memoryIdByUrl: alignment.byUrl,
        noteByMemoryId: alignment.noteByMemoryId
      }
    )

    const bookmarkCount = countBookmarkLibraryLeaves(roots)
    flowOk('Import', '读取书签目录树', startedAt, {
      bookmarkCount,
      syncReady: importState?.status === 'completed'
    })
    return {
      ok: true,
      roots,
      bookmarkCount,
      syncReady: importState?.status === 'completed'
    }
  } catch (error) {
    flowFail('Import', '读取书签目录树', startedAt, error)
    return {
      ok: false,
      errorCode: 'LIBRARY_TREE_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
