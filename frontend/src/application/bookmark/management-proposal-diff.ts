import { bookmarkDiffService, type DiffResult } from '@/application/bookmark/bookmark-diff-service'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'

/**
 * 计算管理页原始树与提案树的 diff（含后处理）
 */
export function calculateManagementProposalDiff(
  originalChildren: BookmarkNode[],
  proposalChildren: BookmarkNode[],
  flatOriginalNodes?: Map<string, BookmarkNode>
): DiffResult | null {
  try {
    const originalRoot: BookmarkNode = {
      id: 'virtual-root',
      title: 'Root',
      children: originalChildren
    }

    const proposalRoot: BookmarkNode = {
      id: 'virtual-root',
      title: 'Root',
      children: proposalChildren
    }

    const diff = bookmarkDiffService.calculateDiff(
      originalRoot,
      proposalRoot,
      flatOriginalNodes ? { flatOriginalNodes } : undefined
    )

    return bookmarkDiffService.postProcessManagementProposalDiff(diff, proposalChildren)
  } catch (error) {
    logger.error('ManagementProposalDiff', '计算差异失败', error)
    return null
  }
}
