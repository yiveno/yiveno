import { chromeStorage } from '@/infrastructure/storage/chrome-storage'
import type { BookmarkNode } from '@/types'

/** 管理页书签树展开状态 Session Storage 键 */
export const MANAGEMENT_EXPANDED_SESSION_KEYS = {
  ORIGINAL: 'bookmark_mgmt_original_expanded',
  PROPOSAL: 'bookmark_mgmt_proposal_expanded'
} as const

/**
 * 从 Session Storage 读取左右树展开文件夹 ID
 */
export async function loadManagementExpandedFolderIds(): Promise<{
  originalIds: string[]
  proposalIds: string[]
}> {
  const [originalIds, proposalIds] = await Promise.all([
    chromeStorage.getSession<string[]>(MANAGEMENT_EXPANDED_SESSION_KEYS.ORIGINAL, []),
    chromeStorage.getSession<string[]>(MANAGEMENT_EXPANDED_SESSION_KEYS.PROPOSAL, [])
  ])

  return {
    originalIds: originalIds ?? [],
    proposalIds: proposalIds ?? []
  }
}

/**
 * 将左右树展开文件夹 ID 写入 Session Storage
 */
export async function saveManagementExpandedFolderIds(
  originalIds: string[],
  proposalIds: string[]
): Promise<void> {
  await Promise.all([
    chromeStorage.setSession(MANAGEMENT_EXPANDED_SESSION_KEYS.ORIGINAL, originalIds),
    chromeStorage.setSession(MANAGEMENT_EXPANDED_SESSION_KEYS.PROPOSAL, proposalIds)
  ])
}

/**
 * 收集提案树中所有文件夹 ID（用于 AI 整理后默认全部展开）
 */
export function collectExpandableFolderIds(nodes: BookmarkNode[]): string[] {
  const ids: string[] = []

  const walk = (folderNodes: BookmarkNode[]): void => {
    for (const node of folderNodes) {
      if (!node.url) {
        ids.push(String(node.id))
        if (node.children?.length) {
          walk(node.children)
        }
      }
    }
  }

  walk(nodes)
  return ids
}

/**
 * 收集提案树根节点 ID（用于重置展开状态）
 */
export function collectRootFolderIds(nodes: BookmarkNode[]): string[] {
  return nodes.map(node => String(node.id))
}
