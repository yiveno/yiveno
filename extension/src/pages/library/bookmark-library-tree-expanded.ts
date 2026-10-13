import { z } from 'zod'

import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import {
  readChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

/** chrome.storage.session：记忆库书签树已展开文件夹 chromeId 列表。 */
export const BOOKMARK_LIBRARY_TREE_EXPANDED_SESSION_KEY = 'library_bookmark_tree_expanded_v1'

const expandedSessionSchema = z.object({
  folderIds: z.array(z.string())
})

/** 默认展开：仅顶层文件夹（depth < 1）。 */
export function collectDefaultExpandedFolderIds(
  nodes: BookmarkLibraryTreeNode[],
  depth = 0
): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    if (node.kind !== 'folder') {
      continue
    }
    if (depth < 1) {
      ids.add(node.chromeId)
    }
    for (const childId of collectDefaultExpandedFolderIds(node.children, depth + 1)) {
      ids.add(childId)
    }
  }
  return ids
}

/** 读取 session 中已展开文件夹；无记录时返回 null（沿用默认 depth 规则）。 */
export async function readBookmarkLibraryTreeExpandedSession(): Promise<Set<string> | null> {
  const data = await readChromeStorageSession(
    BOOKMARK_LIBRARY_TREE_EXPANDED_SESSION_KEY,
    expandedSessionSchema
  )
  if (!data) {
    return null
  }
  return new Set(data.folderIds)
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** 防抖写入展开状态，避免连续点击 folder 时频繁写 storage。 */
export function schedulePersistBookmarkLibraryTreeExpanded(folderIds: Set<string>): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
  }
  persistTimer = setTimeout(() => {
    persistTimer = null
    void writeChromeStorageSession(BOOKMARK_LIBRARY_TREE_EXPANDED_SESSION_KEY, {
      folderIds: [...folderIds]
    })
  }, 400)
}
