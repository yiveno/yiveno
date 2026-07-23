import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'

/** Chrome 书签树中可导入的叶子节点。 */
export interface ChromeBookmarkLeaf {
  chromeBookmarkId: string
  title: string
  url: string
  parentFolderId?: string
  chromeCreatedAt?: string
}

/** 将单个 Chrome 书签节点转为可导入叶子；文件夹或不可保存 URL 返回 null。 */
export function toChromeBookmarkLeaf(
  node: chrome.bookmarks.BookmarkTreeNode
): ChromeBookmarkLeaf | null {
  if (!node.url || !isSavablePageUrl(node.url)) {
    return null
  }

  return {
    chromeBookmarkId: node.id,
    title: node.title.trim() || node.url,
    url: node.url,
    parentFolderId: node.parentId,
    chromeCreatedAt:
      typeof node.dateAdded === 'number' ? new Date(node.dateAdded).toISOString() : undefined
  }
}

/** 将 Chrome 书签树扁平化为可保存的 http(s) 书签。 */
export function flattenChromeBookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): ChromeBookmarkLeaf[] {
  const leaves: ChromeBookmarkLeaf[] = []

  const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    const leaf = toChromeBookmarkLeaf(node)
    if (leaf) {
      leaves.push(leaf)
    }

    for (const child of node.children ?? []) {
      visit(child)
    }
  }

  for (const node of nodes) {
    visit(node)
  }

  return leaves
}

/** 读取单个 Chrome 书签节点。 */
export async function readChromeBookmarkById(
  chromeBookmarkId: string
): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const nodes = await chrome.bookmarks.get(chromeBookmarkId)
  return nodes[0] ?? null
}

/** 读取整棵 Chrome 书签树并扁平化。 */
export async function readChromeBookmarkLeaves(): Promise<ChromeBookmarkLeaf[]> {
  const tree = await chrome.bookmarks.getTree()
  return flattenChromeBookmarkTree(tree)
}
