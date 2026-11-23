/**
 * 记忆库书签树客户端搜索（纯函数）。
 * 与 LIST query 同一归一化 + 子串规则；搜索展开为派生态，不写 session。
 */
import type {
  BookmarkLibraryIndex,
  BookmarkLibraryIndexNode,
  BookmarkLibraryVisibleRow
} from '@/core/memory/bookmark-library-index'
import { normalizeRecallText } from '@/core/recall/keyword-filter'

/** 书签/文件夹标题 · URL · 附注任一命中。 */
function bookmarkLibraryNodeMatchesQuery(
  node: BookmarkLibraryIndexNode,
  normalizedQuery: string
): boolean {
  if (normalizeRecallText(node.title).includes(normalizedQuery)) {
    return true
  }
  if (node.url && normalizeRecallText(node.url).includes(normalizedQuery)) {
    return true
  }
  if (node.note && normalizeRecallText(node.note).includes(normalizedQuery)) {
    return true
  }
  return false
}

function markAncestorsVisible(
  nodeById: ReadonlyMap<string, BookmarkLibraryIndexNode>,
  chromeId: string,
  visibleIds: Set<string>,
  autoExpandedFolderIds: Set<string>
): void {
  let parentId = nodeById.get(chromeId)?.parentId ?? null
  while (parentId) {
    visibleIds.add(parentId)
    autoExpandedFolderIds.add(parentId)
    parentId = nodeById.get(parentId)?.parentId ?? null
  }
}

function markSubtreeVisible(
  nodeById: ReadonlyMap<string, BookmarkLibraryIndexNode>,
  folderId: string,
  visibleIds: Set<string>,
  autoExpandedFolderIds: Set<string>
): void {
  const folder = nodeById.get(folderId)
  if (!folder || folder.kind !== 'folder') {
    return
  }
  visibleIds.add(folderId)
  autoExpandedFolderIds.add(folderId)
  for (const childId of folder.childIds) {
    visibleIds.add(childId)
    const child = nodeById.get(childId)
    if (child?.kind === 'folder') {
      markSubtreeVisible(nodeById, childId, visibleIds, autoExpandedFolderIds)
    }
  }
}

/**
 * 将扁平索引投影为搜索过滤后的可见行。
 * 空/纯空白 query → 空数组（调用方应改走未过滤 flatten）。
 */
export function flattenBookmarkLibrarySearchVisibleRows(
  index: BookmarkLibraryIndex,
  nodeById: ReadonlyMap<string, BookmarkLibraryIndexNode>,
  query: string
): BookmarkLibraryVisibleRow[] {
  const normalizedQuery = normalizeRecallText(query)
  if (!normalizedQuery) {
    return []
  }

  const visibleIds = new Set<string>()
  const autoExpandedFolderIds = new Set<string>()

  for (const node of index.nodes) {
    if (!bookmarkLibraryNodeMatchesQuery(node, normalizedQuery)) {
      continue
    }
    if (node.kind === 'folder') {
      markSubtreeVisible(nodeById, node.chromeId, visibleIds, autoExpandedFolderIds)
      markAncestorsVisible(nodeById, node.chromeId, visibleIds, autoExpandedFolderIds)
      continue
    }
    visibleIds.add(node.chromeId)
    markAncestorsVisible(nodeById, node.chromeId, visibleIds, autoExpandedFolderIds)
  }

  const rows: BookmarkLibraryVisibleRow[] = []

  function walk(ids: readonly string[], depth: number): void {
    for (const id of ids) {
      if (!visibleIds.has(id)) {
        continue
      }
      const node = nodeById.get(id)
      if (!node) {
        continue
      }
      if (node.kind === 'folder') {
        const expanded = autoExpandedFolderIds.has(id)
        rows.push({
          kind: 'folder',
          chromeId: id,
          depth,
          title: node.title,
          hasNote: false,
          expanded
        })
        if (expanded) {
          walk(node.childIds, depth + 1)
        }
        continue
      }

      rows.push({
        kind: 'bookmark',
        chromeId: id,
        depth,
        title: node.title,
        hasNote: node.hasNote,
        ...(node.url !== undefined ? { url: node.url } : {}),
        ...(node.memoryItemId ? { memoryItemId: node.memoryItemId } : {}),
        ...(node.note ? { note: node.note } : {}),
        ...(node.savedAt ? { savedAt: node.savedAt } : {})
      })
    }
  }

  walk(index.rootIds, 0)
  return rows
}
