/**
 * 记忆库书签扁平索引（只读视图模型）。
 * 供虚拟列表、SW 缓存 diff、markRaw 消费；避免嵌套树 deep reactive。
 */

import type {
  ChromeBookmarkTreeInput,
  MapChromeBookmarkTreeOptions
} from '@/core/memory/bookmark-library-tree'
import { normalizeBookmarkSyncUrl } from '@/core/memory/bookmark-library-tree'

/** 扁平索引版本号（协议变更时递增）。 */
export const BOOKMARK_LIBRARY_INDEX_VERSION = 1 as const

export interface BookmarkLibraryIndexNode {
  chromeId: string
  parentId: string | null
  /** folder：目录；bookmark：http(s) 叶子 */
  kind: 'folder' | 'bookmark'
  title: string
  url?: string
  memoryItemId?: string
  hasNote: boolean
  note?: string
  /** 仅 folder：有序子节点 chromeId */
  childIds: string[]
}

export interface BookmarkLibraryIndex {
  version: typeof BOOKMARK_LIBRARY_INDEX_VERSION
  nodes: BookmarkLibraryIndexNode[]
  rootIds: string[]
  bookmarkCount: number
}

/** 虚拟列表可见行（由 index + 展开集投影）。 */
export interface BookmarkLibraryVisibleRow {
  kind: 'folder' | 'bookmark'
  chromeId: string
  depth: number
  title: string
  url?: string
  memoryItemId?: string
  hasNote: boolean
  note?: string
  /** 仅 folder */
  expanded?: boolean
}

export const BOOKMARK_LIBRARY_ROW_HEIGHT = 44
export const BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE = 76

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveMemoryItemId(
  chromeId: string,
  url: string,
  memoryIdByChromeBookmarkId: ReadonlyMap<string, string>,
  memoryIdByUrl: ReadonlyMap<string, string> | undefined
): string | undefined {
  const byId = memoryIdByChromeBookmarkId.get(chromeId)
  if (byId) {
    return byId
  }
  return memoryIdByUrl?.get(normalizeBookmarkSyncUrl(url))
}

interface MapIndexContext {
  nodes: Map<string, BookmarkLibraryIndexNode>
  bookmarkCount: number
  memoryIdByChromeBookmarkId: ReadonlyMap<string, string>
  options: MapChromeBookmarkTreeOptions
}

function mapChromeNodeToIndex(
  node: ChromeBookmarkTreeInput,
  parentId: string | null,
  ctx: MapIndexContext
): BookmarkLibraryIndexNode | null {
  const url = node.url?.trim()
  if (url) {
    if (!isHttpUrl(url)) {
      return null
    }
    const memoryItemId = resolveMemoryItemId(
      node.id,
      url,
      ctx.memoryIdByChromeBookmarkId,
      ctx.options.memoryIdByUrl
    )
    const note = memoryItemId ? ctx.options.noteByMemoryId?.get(memoryItemId)?.trim() : undefined
    const bookmark: BookmarkLibraryIndexNode = {
      chromeId: node.id,
      parentId,
      kind: 'bookmark',
      title: node.title?.trim() || url,
      url,
      childIds: [],
      hasNote: Boolean(note),
      ...(memoryItemId ? { memoryItemId } : {}),
      ...(note ? { note } : {})
    }
    ctx.nodes.set(node.id, bookmark)
    ctx.bookmarkCount += 1
    return bookmark
  }

  const childIds: string[] = []
  for (const child of node.children ?? []) {
    const mapped = mapChromeNodeToIndex(child, node.id, ctx)
    if (mapped) {
      childIds.push(mapped.chromeId)
    }
  }

  const folder: BookmarkLibraryIndexNode = {
    chromeId: node.id,
    parentId,
    kind: 'folder',
    title: node.title?.trim() || ctx.options.unnamedFolderTitle,
    childIds,
    hasNote: false
  }
  ctx.nodes.set(node.id, folder)
  return folder
}

/**
 * 将 Chrome 书签树映射为扁平索引。
 * 根节点无标题且有子级时，与嵌套 forest 一致：上提子级为 rootIds。
 */
export function mapChromeBookmarkTreeToLibraryIndex(
  roots: ChromeBookmarkTreeInput[],
  memoryIdByChromeBookmarkId: ReadonlyMap<string, string>,
  options: MapChromeBookmarkTreeOptions
): BookmarkLibraryIndex {
  const ctx: MapIndexContext = {
    nodes: new Map(),
    bookmarkCount: 0,
    memoryIdByChromeBookmarkId,
    options
  }
  const rootIds: string[] = []

  for (const root of roots) {
    const mapped = mapChromeNodeToIndex(root, null, ctx)
    if (!mapped) {
      continue
    }
    if (mapped.kind === 'folder' && !root.title?.trim() && mapped.childIds.length > 0) {
      rootIds.push(...mapped.childIds)
      continue
    }
    rootIds.push(mapped.chromeId)
  }

  return {
    version: BOOKMARK_LIBRARY_INDEX_VERSION,
    nodes: Array.from(ctx.nodes.values()),
    rootIds,
    bookmarkCount: ctx.bookmarkCount
  }
}

/** chromeId → 节点；UI 侧对 markRaw index 构建一次。 */
export function buildBookmarkLibraryNodeMap(
  index: BookmarkLibraryIndex
): Map<string, BookmarkLibraryIndexNode> {
  return new Map(index.nodes.map(node => [node.chromeId, node]))
}

/** 结构 + 对齐 + 附注指纹；供 SW/UI 条件刷新。 */
export function computeBookmarkLibraryStructureHash(index: BookmarkLibraryIndex): string {
  let hash = 5381
  const sorted = [...index.nodes].sort((a, b) => a.chromeId.localeCompare(b.chromeId))
  for (const node of sorted) {
    const part = [
      node.chromeId,
      node.parentId ?? '',
      node.kind,
      node.title,
      node.url ?? '',
      node.childIds.join(','),
      node.memoryItemId ?? '',
      node.hasNote ? '1' : '0',
      node.note ?? ''
    ].join('|')
    for (let i = 0; i < part.length; i += 1) {
      hash = (hash * 33) ^ part.charCodeAt(i)
    }
  }
  return (hash >>> 0).toString(36)
}

export function resolveBookmarkFolderExpanded(
  expandedFolderIds: ReadonlySet<string> | null,
  chromeId: string,
  depth: number,
  /** null 状态下 depth < defaultExpandDepth 的文件夹默认展开（1 = 仅顶层）。 */
  defaultExpandDepth = 1
): boolean {
  if (expandedFolderIds === null) {
    return depth < defaultExpandDepth
  }
  return expandedFolderIds.has(chromeId)
}

/**
 * 将扁平索引投影为可见行（仅遍历已展开分支）。
 * @param nodeById 由 buildBookmarkLibraryNodeMap 构建
 */
export function flattenBookmarkLibraryVisibleRows(
  index: BookmarkLibraryIndex,
  nodeById: ReadonlyMap<string, BookmarkLibraryIndexNode>,
  expandedFolderIds: ReadonlySet<string> | null,
  options: { defaultExpandDepth?: number } = {}
): BookmarkLibraryVisibleRow[] {
  const defaultExpandDepth = options.defaultExpandDepth ?? 1
  const rows: BookmarkLibraryVisibleRow[] = []

  function walk(ids: readonly string[], depth: number): void {
    for (const id of ids) {
      const node = nodeById.get(id)
      if (!node) {
        continue
      }
      if (node.kind === 'folder') {
        const expanded = resolveBookmarkFolderExpanded(
          expandedFolderIds,
          id,
          depth,
          defaultExpandDepth
        )
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
        url: node.url,
        hasNote: node.hasNote,
        ...(node.memoryItemId ? { memoryItemId: node.memoryItemId } : {}),
        ...(node.note ? { note: node.note } : {})
      })
    }
  }

  walk(index.rootIds, 0)
  return rows
}

/** 虚拟列表行高：有附注的书签更高。 */
export function getBookmarkLibraryRowHeight(row: BookmarkLibraryVisibleRow): number {
  if (row.kind === 'bookmark' && row.note) {
    return BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE
  }
  return BOOKMARK_LIBRARY_ROW_HEIGHT
}

/** 单点更新附注，避免全树重建。 */
export function patchBookmarkNoteInIndex(
  index: BookmarkLibraryIndex,
  memoryItemId: string,
  note: string | null
): BookmarkLibraryIndex {
  const trimmed = note?.trim() || null
  let changed = false
  const nodes = index.nodes.map(node => {
    if (node.memoryItemId !== memoryItemId) {
      return node
    }
    changed = true
    const next: BookmarkLibraryIndexNode = {
      ...node,
      hasNote: Boolean(trimmed)
    }
    if (trimmed) {
      next.note = trimmed
    } else {
      delete next.note
    }
    return next
  })
  if (!changed) {
    return index
  }
  return { ...index, nodes }
}

/** 从 index 收集默认展开的顶层文件夹 id。 */
export function collectDefaultExpandedFolderIdsFromIndex(
  index: BookmarkLibraryIndex,
  nodeById: ReadonlyMap<string, BookmarkLibraryIndexNode>
): Set<string> {
  const ids = new Set<string>()
  for (const rootId of index.rootIds) {
    const node = nodeById.get(rootId)
    if (node?.kind === 'folder') {
      ids.add(rootId)
    }
  }
  return ids
}
