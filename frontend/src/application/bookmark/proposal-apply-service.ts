/**
 * 管理页提案应用服务
 *
 * 负责将 diff 操作列表排序并经由 Background Script 写入 Chrome 书签 API。
 */

import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'
import {
  findRecentFolderInTree,
  isTransientMessageError
} from '@/application/bookmark/bookmark-apply-guards'
import { TIMEOUT_CONFIG } from '@/config/constants'
import {
  isChromeSystemBookmarkId,
  normalizeWritableBookmarkParentId
} from '@/core/bookmark/chrome-system-ids'
import { logger } from '@/infrastructure/logging/logger'

/** 单条 apply 进度 */
export interface ProposalApplyProgress {
  current: number
  total: number
  operationTitle: string
  operation: BookmarkOperation
}

/** 单条 apply 失败记录 */
export interface ProposalApplyError {
  operation: BookmarkOperation
  error: string
}

/** apply 执行结果 */
export interface ProposalApplyResult {
  success: boolean
  errors: ProposalApplyError[]
}

const DEFAULT_BATCH_SIZE = 50

/**
 * 解析 parentId（临时文件夹 ID → Chrome 真实 ID）
 */
export function resolveProposalParentId(
  parentId: string | undefined,
  tempIdMap: Map<string, string>
): string {
  return normalizeWritableBookmarkParentId(
    parentId ? (tempIdMap.get(parentId) ?? parentId) : undefined
  )
}

/**
 * 为应用更改排序：先建文件夹（父先于子），再移动，再编辑，最后删除
 */
export function sortOperationsForApply(operations: BookmarkOperation[]): BookmarkOperation[] {
  const folderCreates = operations.filter(
    (op): op is BookmarkOperation & { type: 'create'; isFolder: true } =>
      op.type === 'create' && op.isFolder
  )
  const others = operations.filter(op => !(op.type === 'create' && op.isFolder))
  const originalOrder = new Map(operations.map((operation, index) => [operation, index]))
  const compareFolderCreate = (
    a: BookmarkOperation & { type: 'create'; isFolder: true },
    b: BookmarkOperation & { type: 'create'; isFolder: true }
  ): number => {
    if (a.parentId === b.parentId) {
      const indexDiff = a.index - b.index
      if (indexDiff !== 0) return indexDiff
    }

    return (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0)
  }

  const sortedFolders: BookmarkOperation[] = []
  const pending = [...folderCreates]
  const createdTempIds = new Set<string>()

  while (pending.length > 0) {
    const ready = pending
      .filter(op => {
        const parentId = op.parentId
        return !parentId.startsWith('temp_') || createdTempIds.has(parentId)
      })
      .sort(compareFolderCreate)

    if (ready.length === 0) {
      sortedFolders.push(...pending.sort(compareFolderCreate))
      break
    }

    for (const op of ready) {
      sortedFolders.push(op)
      if (op.nodeId.startsWith('temp_')) {
        createdTempIds.add(op.nodeId)
      }
      pending.splice(pending.indexOf(op), 1)
    }
  }

  const weight = (op: BookmarkOperation): number => {
    if (op.type === 'move') return 1
    if (op.type === 'edit') return 2
    if (op.type === 'create' && !op.isFolder) return 3
    return 4
  }

  return [...sortedFolders, ...others.sort((a, b) => weight(a) - weight(b))]
}

/**
 * 提案应用服务：排序并执行 Chrome 书签变更
 */
export class ProposalApplyService {
  /**
   * 向 Background 发送消息（含 SW 冷启动重试）
   */
  private async sendRuntimeMessage<TResponse>(
    message: { type: string; data?: unknown },
    retries = 2
  ): Promise<TResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await new Promise<TResponse>((resolve, reject) => {
          chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
              return
            }
            resolve(response as TResponse)
          })
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (!isTransientMessageError(lastError.message) || attempt === retries) {
          throw lastError
        }

        logger.warn('ProposalApply', 'Background 消息发送失败，准备重试', {
          type: message.type,
          attempt: attempt + 1,
          error: lastError.message
        })
        await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
      }
    }

    throw lastError ?? new Error('Background 消息发送失败')
  }

  private async findRecentFolder(
    parentId: string,
    title: string,
    since: number
  ): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
    const response = await this.sendRuntimeMessage<{
      success?: boolean
      tree?: chrome.bookmarks.BookmarkTreeNode[]
      error?: string
    }>(
      {
        type: 'GET_BOOKMARK_TREE'
      },
      2
    )

    if (!response.success || !response.tree) {
      return null
    }

    return findRecentFolderInTree(response.tree, parentId, title, since)
  }

  private async createFolderWithRecovery(folderData: {
    title: string
    parentId: string
    index?: number
  }): Promise<{ success: boolean; folderId?: string; error?: string }> {
    const startedAt = Date.now()

    try {
      return await this.sendRuntimeMessage<{
        success: boolean
        folderId?: string
        error?: string
      }>(
        {
          type: 'CREATE_FOLDER',
          data: folderData
        },
        0
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!isTransientMessageError(errorMessage)) {
        throw error
      }

      const existingFolder = await this.findRecentFolder(
        folderData.parentId,
        folderData.title,
        startedAt
      )
      if (existingFolder) {
        logger.warn('ProposalApply', '文件夹创建响应丢失，已通过 Chrome 树回查恢复', {
          title: folderData.title,
          folderId: existingFolder.id
        })
        return { success: true, folderId: existingFolder.id }
      }

      logger.warn('ProposalApply', '文件夹创建响应丢失且未回查到结果，重试创建', {
        title: folderData.title,
        parentId: folderData.parentId
      })
      return await this.sendRuntimeMessage<{
        success: boolean
        folderId?: string
        error?: string
      }>(
        {
          type: 'CREATE_FOLDER',
          data: folderData
        },
        2
      )
    }
  }

  /**
   * 应用批量变更后请求 Background 做一次权威全量同步
   */
  async requestFullBookmarkSync(): Promise<void> {
    const response = await this.sendRuntimeMessage<{
      ok?: boolean
      success?: boolean
      error?: string
    }>({ type: 'SYNC_BOOKMARKS' }, 3)

    if (response.ok !== true && response.success !== true) {
      throw new Error(response.error || '同步失败')
    }
  }

  private async executeDelete(operation: BookmarkOperation): Promise<void> {
    if (operation.type !== 'delete') return

    const deleteOpResponse = await this.sendRuntimeMessage<{
      success: boolean
      error?: string
    }>({
      type: operation.isFolder ? 'REMOVE_TREE_BOOKMARK' : 'DELETE_BOOKMARK',
      data: { id: operation.nodeId }
    })

    if (!deleteOpResponse.success) {
      throw new Error(deleteOpResponse.error || '删除失败')
    }
  }

  private async executeMove(
    operation: BookmarkOperation,
    tempIdMap: Map<string, string>
  ): Promise<void> {
    if (operation.type !== 'move') return

    if (!operation.nodeId || operation.nodeId.startsWith('temp_')) {
      throw new Error(`无效的书签 ID: ${operation.nodeId}`)
    }

    if (isChromeSystemBookmarkId(operation.nodeId)) {
      return
    }

    const parentId = resolveProposalParentId(operation.toParentId, tempIdMap)
    if (parentId.startsWith('temp_')) {
      throw new Error(`目标文件夹尚未创建: ${parentId}`)
    }

    const movePayload: { id: string; parentId: string; index?: number } = {
      id: operation.nodeId,
      parentId
    }
    if (!operation.toParentId.startsWith('temp_')) {
      movePayload.index = operation.toIndex
    }

    const moveResponse = await this.sendRuntimeMessage<{
      success: boolean
      error?: string
    }>({
      type: 'MOVE_BOOKMARK',
      data: movePayload
    })

    if (!moveResponse.success) {
      throw new Error(moveResponse.error || '移动失败')
    }
  }

  private async executeEdit(operation: BookmarkOperation): Promise<void> {
    if (operation.type !== 'edit') return

    const editResponse = await this.sendRuntimeMessage<{
      success: boolean
      error?: string
    }>({
      type: 'UPDATE_BOOKMARK',
      data: {
        id: operation.nodeId,
        title: operation.newTitle,
        url: operation.newUrl
      }
    })

    if (!editResponse.success) {
      throw new Error(editResponse.error || '更新失败')
    }
  }

  private async executeCreate(
    operation: BookmarkOperation,
    tempIdMap: Map<string, string>
  ): Promise<void> {
    if (operation.type !== 'create') return

    const parentId = resolveProposalParentId(operation.parentId, tempIdMap)
    if (parentId.startsWith('temp_')) {
      throw new Error(`父文件夹尚未创建: ${parentId}`)
    }

    if (operation.isFolder) {
      const folderData: { title: string; parentId: string; index?: number } = {
        title: operation.title,
        parentId,
        index: operation.index
      }

      const createFolderResponse = await this.createFolderWithRecovery(folderData)

      if (!createFolderResponse.success || !createFolderResponse.folderId) {
        throw new Error(createFolderResponse.error || '创建文件夹失败')
      }

      if (operation.nodeId.startsWith('temp_')) {
        tempIdMap.set(operation.nodeId, createFolderResponse.folderId)
      }
      return
    }

    const createResponse = await this.sendRuntimeMessage<{
      success: boolean
      bookmark?: chrome.bookmarks.BookmarkTreeNode
      error?: string
    }>({
      type: 'CREATE_BOOKMARK',
      data: {
        title: operation.title,
        url: operation.url,
        parentId,
        index: operation.index
      }
    })

    if (!createResponse.success) {
      throw new Error(createResponse.error || '创建失败')
    }
  }

  private async executeOperation(
    operation: BookmarkOperation,
    tempIdMap: Map<string, string>
  ): Promise<void> {
    switch (operation.type) {
      case 'delete':
        await this.executeDelete(operation)
        break
      case 'move':
        await this.executeMove(operation, tempIdMap)
        break
      case 'edit':
        await this.executeEdit(operation)
        break
      case 'create':
        await this.executeCreate(operation, tempIdMap)
        break
    }
  }

  /**
   * 按排序后的顺序执行提案操作（遇错即停）
   */
  async applyOperations(
    operations: BookmarkOperation[],
    options?: {
      onProgress?: (progress: ProposalApplyProgress) => void
      batchSize?: number
      batchDelayMs?: number
    }
  ): Promise<ProposalApplyResult> {
    const orderedOperations = sortOperationsForApply(operations)
    const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
    const batchDelayMs = options?.batchDelayMs ?? TIMEOUT_CONFIG.DELAY.IMMEDIATE

    const tempIdMap = new Map<string, string>()
    const errors: ProposalApplyError[] = []
    let applyAborted = false

    for (let i = 0; i < orderedOperations.length && !applyAborted; i += batchSize) {
      const batch = orderedOperations.slice(i, Math.min(i + batchSize, orderedOperations.length))

      for (const operation of batch) {
        if (applyAborted) {
          break
        }

        const currentIndex = i + batch.indexOf(operation) + 1
        options?.onProgress?.({
          current: currentIndex,
          total: orderedOperations.length,
          operationTitle: operation.title,
          operation
        })

        try {
          await this.executeOperation(operation, tempIdMap)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error('ProposalApply', `操作失败，已中止后续 apply: ${operation.type}`, {
            nodeId: operation.nodeId,
            error: errorMessage
          })
          errors.push({ operation, error: errorMessage })
          applyAborted = true
        }
      }

      await new Promise(resolve => setTimeout(resolve, batchDelayMs))
    }

    return {
      success: errors.length === 0,
      errors
    }
  }
}

export const proposalApplyService = new ProposalApplyService()
