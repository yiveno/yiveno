/**
 * 管理页提案应用前可执行性校验（AI / 手动编辑通用）
 */

import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'
import { flattenProposalNodeMap } from '@/application/bookmark/organize-proposal-audit'
import {
  isChromeSystemBookmarkId,
  isVirtualBookmarkRootId
} from '@/core/bookmark/chrome-system-ids'
import { isTempFolderId } from '@/core/bookmark/temp-folder-ids'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'

const loggerPrefix = 'ProposalApplyValidation'

export interface ProposalApplyValidationIssue {
  code: string
  message: string
  nodeId?: string
}

export interface ProposalApplyValidationResult {
  ok: boolean
  issues: ProposalApplyValidationIssue[]
}

/**
 * 临时文件夹父链是否可在提案树中解析（直至 Chrome 可写父级或非 temp 节点）
 */
function hasResolvableTempParentChain(
  tempId: string,
  proposalMap: Map<string, BookmarkNode>
): boolean {
  let current: string | undefined = tempId
  const visited = new Set<string>()

  while (current && isTempFolderId(current)) {
    if (visited.has(current)) {
      return false
    }
    visited.add(current)

    const node = proposalMap.get(current)
    if (!node) {
      return false
    }

    const parentId = node.parentId ? String(node.parentId) : undefined
    if (!parentId || parentId === '0') {
      return false
    }
    if (!isTempFolderId(parentId)) {
      return proposalMap.has(parentId) || isChromeSystemBookmarkId(parentId)
    }
    current = parentId
  }

  return true
}

/**
 * 校验 diff 操作是否可在当前左侧树与右侧提案状态下执行
 */
export function validateProposalBeforeApply(
  operations: BookmarkOperation[],
  proposalRoots: BookmarkNode[],
  flatOriginalNodes: Map<string, BookmarkNode>
): ProposalApplyValidationResult {
  const issues: ProposalApplyValidationIssue[] = []
  const proposalMap = flattenProposalNodeMap(proposalRoots)

  const tempFolderIds = new Set(
    [...proposalMap.entries()]
      .filter(([id, node]) => isTempFolderId(id) && !node.url)
      .map(([id]) => id)
  )

  for (const op of operations) {
    if (op.type === 'delete' || op.type === 'move' || op.type === 'edit') {
      if (isChromeSystemBookmarkId(op.nodeId)) {
        issues.push({
          code: 'SYSTEM_NODE_MUTATION',
          message: '不可变更 Chrome 系统节点',
          nodeId: op.nodeId
        })
      } else if (!flatOriginalNodes.has(op.nodeId)) {
        issues.push({
          code: 'MISSING_ORIGINAL_NODE',
          message: '左侧树中已不存在该节点，请刷新后重试',
          nodeId: op.nodeId
        })
      }
    }

    if (op.type === 'move') {
      const targetParentId = op.toParentId
      if (isTempFolderId(targetParentId)) {
        if (!tempFolderIds.has(targetParentId)) {
          issues.push({
            code: 'MISSING_TEMP_TARGET',
            message: '移动目标临时文件夹不在提案树中',
            nodeId: targetParentId
          })
        } else if (!hasResolvableTempParentChain(targetParentId, proposalMap)) {
          issues.push({
            code: 'BROKEN_TEMP_TARGET_CHAIN',
            message: '移动目标临时文件夹父链无效',
            nodeId: targetParentId
          })
        }
      } else if (
        !isVirtualBookmarkRootId(targetParentId) &&
        !isChromeSystemBookmarkId(targetParentId) &&
        !flatOriginalNodes.has(targetParentId) &&
        !proposalMap.has(targetParentId)
      ) {
        issues.push({
          code: 'MISSING_MOVE_TARGET',
          message: '移动目标文件夹不存在，请刷新后重试',
          nodeId: targetParentId
        })
      }
    }

    if (op.type === 'create' && op.isFolder && isTempFolderId(op.nodeId)) {
      const parentId = op.parentId
      if (isTempFolderId(parentId)) {
        if (!tempFolderIds.has(parentId)) {
          issues.push({
            code: 'MISSING_TEMP_PARENT',
            message: '新建临时文件夹的父级不在提案树中',
            nodeId: op.nodeId
          })
        } else if (!hasResolvableTempParentChain(parentId, proposalMap)) {
          issues.push({
            code: 'BROKEN_TEMP_PARENT_CHAIN',
            message: '新建临时文件夹父链无效',
            nodeId: op.nodeId
          })
        }
      } else if (
        !isVirtualBookmarkRootId(parentId) &&
        !isChromeSystemBookmarkId(parentId) &&
        !flatOriginalNodes.has(parentId) &&
        !proposalMap.has(parentId)
      ) {
        issues.push({
          code: 'MISSING_CREATE_PARENT',
          message: '新建文件夹的父级不存在，请刷新后重试',
          nodeId: parentId
        })
      }
    }
  }

  for (const tempId of tempFolderIds) {
    if (!hasResolvableTempParentChain(tempId, proposalMap)) {
      issues.push({
        code: 'BROKEN_TEMP_CHAIN',
        message: '提案树中存在无效的临时文件夹链',
        nodeId: tempId
      })
    }
  }

  const result: ProposalApplyValidationResult = {
    ok: issues.length === 0,
    issues
  }

  if (!result.ok) {
    logger.error(loggerPrefix, '提案应用前校验失败', {
      issueCount: issues.length,
      sample: issues.slice(0, 5)
    })
  }

  return result
}
