/**
 * 一键整理提案完整性审计
 *
 * 原则：参与整理的每个书签 ID 必须出现在提案树中，且位于提案新建目录（temp_ai_* / temp_*）子树下。
 * 不满足则整理失败，不进入预览，不改动 Chrome 书签。
 */

import { isNodeUnderProposalNewFolderSubtree } from '@/application/bookmark/proposal-tree-normalize'
import { isOrganizeBookmarkLeaf } from '@/core/bookmark/organize-bookmark-leaf'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
import type { OrganizeBookmarkSnapshot } from './bookmark-organize-service'

const loggerPrefix = 'OrganizeProposalAudit'

export interface OrganizeProposalAuditResult {
  ok: boolean
  missingIds: string[]
  notInAiSubtreeIds: string[]
  totalExpected: number
  totalPresentInProposal: number
  totalInAiSubtree: number
}

/**
 * 展平提案树为 id → 节点（含文件夹与书签）
 */
export function flattenProposalNodeMap(roots: BookmarkNode[]): Map<string, BookmarkNode> {
  const map = new Map<string, BookmarkNode>()

  const walk = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      const id = String(node.id)
      map.set(id, node)
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(roots)
  return map
}

/**
 * 节点是否位于提案新建目录子树（temp_ai_* / temp_*，与手动编辑一致）。
 */
export function isNodeUnderOrganizeProposalNewFolder(
  nodeId: string,
  nodeMap: Map<string, BookmarkNode>
): boolean {
  return isNodeUnderProposalNewFolderSubtree(nodeId, nodeMap)
}

/**
 * @deprecated 使用 isNodeUnderOrganizeProposalNewFolder
 */
export function isNodeUnderAiOrganizeSubtree(
  nodeId: string,
  nodeMap: Map<string, BookmarkNode>
): boolean {
  return isNodeUnderOrganizeProposalNewFolder(nodeId, nodeMap)
}

/**
 * 审计整理提案是否包含全部参与整理的书签，且均已归入提案新建目录。
 */
export function auditOrganizeProposalIntegrity(
  bookmarkItems: readonly OrganizeBookmarkSnapshot[],
  proposalRoots: BookmarkNode[]
): OrganizeProposalAuditResult {
  const nodeMap = flattenProposalNodeMap(proposalRoots)
  const missingIds: string[] = []
  const notInAiSubtreeIds: string[] = []
  let totalPresentInProposal = 0
  let totalInAiSubtree = 0

  for (const item of bookmarkItems) {
    const id = String(item.id)
    const node = nodeMap.get(id)

    if (!node || !isOrganizeBookmarkLeaf(node)) {
      missingIds.push(id)
      continue
    }

    totalPresentInProposal++

    if (!isNodeUnderOrganizeProposalNewFolder(id, nodeMap)) {
      notInAiSubtreeIds.push(id)
      continue
    }

    totalInAiSubtree++
  }

  const result: OrganizeProposalAuditResult = {
    ok: missingIds.length === 0 && notInAiSubtreeIds.length === 0,
    missingIds,
    notInAiSubtreeIds,
    totalExpected: bookmarkItems.length,
    totalPresentInProposal,
    totalInAiSubtree
  }

  if (!result.ok) {
    logger.error(loggerPrefix, '整理提案完整性校验失败', {
      totalExpected: result.totalExpected,
      missingCount: missingIds.length,
      notInAiSubtreeCount: notInAiSubtreeIds.length,
      missingSample: missingIds.slice(0, 5),
      notInAiSubtreeSample: notInAiSubtreeIds.slice(0, 5)
    })
  } else {
    logger.info(loggerPrefix, '整理提案完整性校验通过', {
      totalExpected: result.totalExpected
    })
  }

  return result
}
