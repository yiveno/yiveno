/**
 * 管理页提案树内存编辑（拖拽移动、增删改节点）
 */

import { flattenProposalNodeMap } from '@/application/bookmark/organize-proposal-audit'
import {
  PROPOSAL_DROP_TARGET_NOT_FOUND,
  shouldInsertAtTopOfChromeRootFolder,
  shouldInsertAtTopOfFolder,
  shouldRedirectDropIntoChromeRootFolder,
  syncProposalTreeMetadata,
  validateProposalMove,
  type ProposalMoveInput
} from '@/application/bookmark/proposal-tree-move'

export type { ProposalMoveInput } from '@/application/bookmark/proposal-tree-move'
import { allocateTempFolderId } from '@/core/bookmark/temp-folder-ids'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'

/** 提案树节点编辑数据 */
export interface ProposalEditNodeData {
  id: string
  title: string
  url?: string
  parentId?: string | undefined
}

/** @deprecated 使用 ProposalEditNodeData */
export type EditBookmarkData = ProposalEditNodeData

/** 提案树拖拽移动结果 */
export interface ProposalMoveResult {
  nodeId: string
  newParentId: string
  newIndex: number
}

/**
 * 在提案树 children 上移动节点（就地修改，调用方需包在 Immer draft 内）
 */
export function moveNodeInProposalTree(
  children: BookmarkNode[],
  data: ProposalMoveInput
): ProposalMoveResult {
  validateProposalMove(children, data)

  let sourceNode: BookmarkNode | null = null

  const findAndRemove = (nodes: BookmarkNode[]): BookmarkNode[] => {
    return nodes.filter(node => {
      if (node.id === data.sourceId) {
        sourceNode = { ...node } as BookmarkNode
        return false
      }
      if (node.children && node.children.length > 0) {
        node.children = findAndRemove(node.children)
      }
      return true
    })
  }

  const remaining = findAndRemove(children)
  children.length = 0
  children.push(...remaining)

  if (!sourceNode) {
    logger.error('ProposalTreeEdit', '未找到源节点', { sourceId: data.sourceId })
    throw new Error('未找到源节点')
  }

  let moveResult: ProposalMoveResult | null = null

  const insertNode = (nodes: BookmarkNode[], parentId: string | undefined): boolean => {
    if (!sourceNode) return false

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (!node) continue

      if (node.id === data.targetId) {
        let insertIndex = -1
        let targetParentId = parentId || 'root'

        if (
          shouldRedirectDropIntoChromeRootFolder(parentId, node.id, data.sourceId, data.position)
        ) {
          if (!node.children) {
            node.children = []
          }
          const insertAtTop = shouldInsertAtTopOfChromeRootFolder(data.position)
          if (insertAtTop) {
            node.children.unshift(sourceNode)
            insertIndex = 0
          } else {
            node.children.push(sourceNode)
            insertIndex = node.children.length - 1
          }
          targetParentId = node.id
          sourceNode.parentId = node.id
          node.children.forEach((child, idx) => {
            child.index = idx
          })
          moveResult = {
            nodeId: data.sourceId,
            newParentId: targetParentId,
            newIndex: insertIndex
          }
          return true
        }

        if (data.position === 'before') {
          nodes.splice(i, 0, sourceNode)
          insertIndex = i
          sourceNode.parentId = parentId
        } else if (data.position === 'after') {
          nodes.splice(i + 1, 0, sourceNode)
          insertIndex = i + 1
          sourceNode.parentId = parentId
        } else if (data.position === 'inside' || data.position === 'inside-last') {
          if (!node.children) {
            node.children = []
          }
          const insertAtTop = shouldInsertAtTopOfFolder(data.position)
          if (insertAtTop) {
            node.children.unshift(sourceNode)
            insertIndex = 0
          } else {
            node.children.push(sourceNode)
            insertIndex = node.children.length - 1
          }
          targetParentId = node.id
          sourceNode.parentId = node.id
        }

        const targetNodes =
          data.position === 'inside' || data.position === 'inside-last' ? node.children! : nodes
        targetNodes.forEach((child, idx) => {
          child.index = idx
        })

        moveResult = {
          nodeId: data.sourceId,
          newParentId: targetParentId,
          newIndex: insertIndex
        }

        return true
      }

      if (node.children && node.children.length > 0) {
        if (insertNode(node.children, node.id)) {
          return true
        }
      }
    }
    return false
  }

  if (!insertNode(children, undefined)) {
    throw new Error(PROPOSAL_DROP_TARGET_NOT_FOUND)
  }

  syncProposalTreeMetadata(children)

  if (!moveResult) {
    throw new Error(PROPOSAL_DROP_TARGET_NOT_FOUND)
  }

  logger.info('ProposalTreeEdit', '✅ 移动节点成功', { ...data, result: moveResult })
  return moveResult
}

/**
 * 从提案树 children 删除节点（就地修改）
 */
export function deleteNodeInProposalTree(children: BookmarkNode[], nodeId: string): boolean {
  let deleted = false

  const deleteRecursive = (nodes: BookmarkNode[]): BookmarkNode[] => {
    return nodes.filter(node => {
      if (node.id === nodeId) {
        deleted = true
        return false
      }
      if (node.children && node.children.length > 0) {
        node.children = deleteRecursive(node.children)
      }
      return true
    })
  }

  const next = deleteRecursive(children)
  children.length = 0
  children.push(...next)

  if (deleted) {
    logger.info('ProposalTreeEdit', `✅ 从提案树删除节点（内存）: ${nodeId}`)
  }

  return deleted
}

/**
 * 编辑提案树中的节点（就地修改）
 */
export function editNodeInProposalTree(
  children: BookmarkNode[],
  data: ProposalEditNodeData
): boolean {
  let edited = false

  const editRecursive = (nodes: BookmarkNode[]): void => {
    for (const node of nodes) {
      if (node.id === data.id) {
        node.title = data.title
        if (data.url !== undefined) {
          node.url = data.url
        }
        edited = true
        return
      }
      if (node.children && node.children.length > 0) {
        editRecursive(node.children)
      }
    }
  }

  editRecursive(children)

  if (edited) {
    logger.info('ProposalTreeEdit', `✅ 编辑提案树节点（内存）: ${data.id}`)
  }

  return edited
}

/**
 * 在提案树中新建临时文件夹（就地修改）
 */
export function createFolderInProposalTree(
  children: BookmarkNode[],
  parentId: string,
  title = '新建文件夹'
): BookmarkNode | null {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return null
  }

  const existingNodeIds = Array.from(flattenProposalNodeMap(children).keys())
  const newId = allocateTempFolderId(existingNodeIds, 'manual')
  let created: BookmarkNode | null = null

  const insertIntoParent = (nodes: BookmarkNode[]): boolean => {
    for (const node of nodes) {
      if (String(node.id) === parentId) {
        if (!node.children) {
          node.children = []
        }
        const newFolder: BookmarkNode = {
          id: newId,
          title: trimmedTitle,
          parentId: String(node.id),
          index: node.children.length,
          children: []
        }
        node.children.push(newFolder)
        node.children.forEach((child, index) => {
          child.index = index
        })
        created = newFolder
        return true
      }
      if (node.children?.length && insertIntoParent(node.children)) {
        return true
      }
    }
    return false
  }

  if (!insertIntoParent(children)) {
    logger.warn('ProposalTreeEdit', '新建文件夹失败：未找到父节点', { parentId })
    return null
  }

  logger.info('ProposalTreeEdit', '✅ 提案树新建文件夹（内存）', {
    id: newId,
    parentId,
    title: trimmedTitle
  })

  return created
}
