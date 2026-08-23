import {
  computeBookmarkLibraryStructureHash,
  mapChromeBookmarkTreeToLibraryIndex
} from '@/core/memory/bookmark-library-index'
import type {
  ChromeBookmarkImportStatusResponse,
  GetBookmarkLibraryTreeResponse
} from '@/core/messaging/import-messages'
import { getChromeBookmarkImportStatus } from '@/application/capture/import-chrome-bookmarks-service'
import {
  getLastBuiltBookmarkLibraryTree,
  invalidateBookmarkLibraryTreeCache,
  rememberBookmarkLibraryTreeBuild
} from '@/application/memory/bookmark-library-tree-cache'
import { getBookmarkSyncAlignmentCached } from '@/application/memory/bookmark-sync-alignment-cache'
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

function toChromeTreeInput(node: chrome.bookmarks.BookmarkTreeNode): {
  id: string
  title?: string
  url?: string
  children?: ReturnType<typeof toChromeTreeInput>[]
} {
  return {
    id: node.id,
    ...(node.title !== undefined ? { title: node.title } : {}),
    ...(node.url !== undefined ? { url: node.url } : {}),
    ...(node.children ? { children: node.children.map(child => toChromeTreeInput(child)) } : {})
  }
}

export interface GetBookmarkLibraryTreeOptions {
  clientHash?: string | undefined
}

/** 读取 Chrome 书签扁平索引并与 Memory 对齐（只读）。 */
export async function handleGetBookmarkLibraryTree(
  options: GetBookmarkLibraryTreeOptions = {}
): Promise<GetBookmarkLibraryTreeResponse> {
  const startedAt = flowStart('Import', '读取书签目录树')
  try {
    const [chromeTree, alignment, importState] = await Promise.all([
      chrome.bookmarks.getTree(),
      getBookmarkSyncAlignmentCached(),
      getChromeBookmarkImportStatus()
    ])

    const index = mapChromeBookmarkTreeToLibraryIndex(
      chromeTree.map(node => toChromeTreeInput(node)),
      alignment.byChromeBookmarkId,
      {
        unnamedFolderTitle: t('library_folder_unnamed'),
        memoryIdByUrl: alignment.byUrl,
        noteByMemoryId: alignment.noteByMemoryId
      }
    )

    const structureHash = computeBookmarkLibraryStructureHash(index)
    const syncReady = importState?.status === 'completed'

    if (options.clientHash && options.clientHash === structureHash) {
      const last = getLastBuiltBookmarkLibraryTree()
      if (last && last.structureHash === structureHash) {
        flowOk('Import', '读取书签目录树', startedAt, {
          bookmarkCount: index.bookmarkCount,
          syncReady,
          unchanged: true
        })
        return {
          ok: true,
          unchanged: true,
          structureHash,
          bookmarkCount: index.bookmarkCount,
          syncReady
        }
      }
    }

    rememberBookmarkLibraryTreeBuild(index, structureHash)

    flowOk('Import', '读取书签目录树', startedAt, {
      bookmarkCount: index.bookmarkCount,
      syncReady,
      unchanged: false
    })
    return {
      ok: true,
      index,
      structureHash,
      bookmarkCount: index.bookmarkCount,
      syncReady
    }
  } catch (error) {
    flowFail('Import', '读取书签目录树', startedAt, error)
    invalidateBookmarkLibraryTreeCache()
    return {
      ok: false,
      errorCode: 'LIBRARY_TREE_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** Chrome 书签树结构变更：失效 SW 侧索引缓存。 */
export function invalidateBookmarkLibraryTreeOnChromeChange(): void {
  invalidateBookmarkLibraryTreeCache()
}
