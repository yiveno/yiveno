/**
 * 记忆库书签目录树（只读视图模型）。
 * 由 Chrome 书签树映射；叶子可挂 memoryItemId。
 */

/** Chrome 书签节点的最小输入（便于单测，不依赖 chrome 全局类型）。 */
export interface ChromeBookmarkTreeInput {
  id: string
  title?: string
  url?: string
  children?: ChromeBookmarkTreeInput[]
}

export interface BookmarkLibraryLeafNode {
  kind: 'bookmark'
  chromeId: string
  title: string
  url: string
  memoryItemId?: string
}

export interface BookmarkLibraryFolderNode {
  kind: 'folder'
  chromeId: string
  title: string
  children: BookmarkLibraryTreeNode[]
}

export type BookmarkLibraryTreeNode = BookmarkLibraryLeafNode | BookmarkLibraryFolderNode

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 归一化书签 URL，供 chromeId 缺失时用 URL 对齐 Memory。
 * 去掉 hash；语言无关。
 */
export function normalizeBookmarkSyncUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.href
  } catch {
    return url.trim()
  }
}

/**
 * 将 Chrome 书签树映射为只读浏览树。
 * - 仅保留 http(s) 书签叶子
 * - 文件夹保留完整层级（含空文件夹）
 * - 根节点若无标题且仅有子级，展开为多根
 * - 无标题文件夹文案由调用方注入（core 不写死 locale）
 * - memoryItemId：优先 chromeBookmarkId，其次 URL
 */
export interface MapChromeBookmarkTreeOptions {
  unnamedFolderTitle: string
  /** URL → MemoryItem.id；chromeId 未命中时回退 */
  memoryIdByUrl?: ReadonlyMap<string, string>
}

export function mapChromeBookmarkTreeToLibraryForest(
  roots: ChromeBookmarkTreeInput[],
  memoryIdByChromeBookmarkId: ReadonlyMap<string, string>,
  options: MapChromeBookmarkTreeOptions
): BookmarkLibraryTreeNode[] {
  const mapped: BookmarkLibraryTreeNode[] = []

  for (const root of roots) {
    const node = mapChromeNode(root, memoryIdByChromeBookmarkId, options)
    if (!node) {
      continue
    }
    if (node.kind === 'folder' && !root.title?.trim() && node.children.length > 0) {
      mapped.push(...node.children)
      continue
    }
    mapped.push(node)
  }

  return mapped
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

function mapChromeNode(
  node: ChromeBookmarkTreeInput,
  memoryIdByChromeBookmarkId: ReadonlyMap<string, string>,
  options: MapChromeBookmarkTreeOptions
): BookmarkLibraryTreeNode | null {
  const url = node.url?.trim()
  if (url) {
    if (!isHttpUrl(url)) {
      return null
    }
    const memoryItemId = resolveMemoryItemId(
      node.id,
      url,
      memoryIdByChromeBookmarkId,
      options.memoryIdByUrl
    )
    return {
      kind: 'bookmark',
      chromeId: node.id,
      title: node.title?.trim() || url,
      url,
      ...(memoryItemId ? { memoryItemId } : {})
    }
  }

  const children: BookmarkLibraryTreeNode[] = []
  for (const child of node.children ?? []) {
    const mapped = mapChromeNode(child, memoryIdByChromeBookmarkId, options)
    if (mapped) {
      children.push(mapped)
    }
  }

  return {
    kind: 'folder',
    chromeId: node.id,
    title: node.title?.trim() || options.unnamedFolderTitle,
    children
  }
}

/** 统计树中书签叶子数。 */
export function countBookmarkLibraryLeaves(nodes: BookmarkLibraryTreeNode[]): number {
  let total = 0
  for (const node of nodes) {
    if (node.kind === 'bookmark') {
      total += 1
    } else {
      total += countBookmarkLibraryLeaves(node.children)
    }
  }
  return total
}
