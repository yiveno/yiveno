/**
 * 书签管理 Store
 * 负责提案树响应式状态与页面级编排（业务逻辑在 application 层）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { treeAppService } from '@/application/bookmark/tree-app-service'
import { useBookmarkStore } from '@/stores/bookmark-tree-store'
import type { BookmarkNode } from '@/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { updateRef } from '@/infrastructure/state/immer-helpers'
import type { BookmarkOperation, DiffResult } from '@/application/bookmark/bookmark-diff-service'
import type { ProposalDropPosition } from '@/application/bookmark/proposal-tree-move'
import { proposalApplyService } from '@/application/bookmark/proposal-apply-service'
import {
  createFolderInProposalTree,
  deleteNodeInProposalTree,
  editNodeInProposalTree,
  moveNodeInProposalTree,
  type ProposalEditNodeData
} from '@/application/bookmark/proposal-tree-edit-service'
import { setBookmarkSyncBatchSuspended } from '@/core/bookmark/bookmark-sync-batch'
import {
  validateProposalBeforeApply,
  type ProposalApplyValidationResult
} from '@/application/bookmark/proposal-apply-validation'
import { pruneEmptiedLegacyBookmarksBarFolders } from '@/application/bookmark/proposal-tree-normalize'
import {
  collectExpandableFolderIds,
  collectRootFolderIds,
  loadManagementExpandedFolderIds,
  saveManagementExpandedFolderIds
} from '@/application/bookmark/management-expanded-state-service'
import { prepareProposalTreeNodes } from '@/application/bookmark/proposal-tree-prepare'
import { calculateManagementProposalDiff } from '@/application/bookmark/management-proposal-diff'
import {
  getProposalPanelIcon,
  getProposalPanelTitle
} from '@/application/bookmark/management-proposal-ui'

export type { ProposalEditNodeData as EditBookmarkData } from '@/application/bookmark/proposal-tree-edit-service'

interface ProposalTreeState {
  id: string
  title: string
  children: BookmarkNode[]
}

interface ApplyProgress {
  isApplying: boolean
  currentOperation: string
  currentIndex: number
  totalOperations: number
  percentage: number
  errors: Array<{ operation: BookmarkOperation; error: string }>
}

export const useBookmarkManagementStore = defineStore('bookmark-management', () => {
  const bookmarkStore = useBookmarkStore()
  const originalTree = computed(() => bookmarkStore.bookmarkTree as BookmarkNode[])

  const newProposalTree = ref<ProposalTreeState>({
    id: 'root-empty',
    title: '等待数据源',
    children: []
  })

  const hasUnsavedChanges = ref(false)
  const applyProgress = ref<ApplyProgress>({
    isApplying: false,
    currentOperation: '',
    currentIndex: 0,
    totalOperations: 0,
    percentage: 0,
    errors: []
  })
  const isAIGenerated = ref(false)
  const isApplyingOwnChanges = ref(false)
  const originalExpandedFolders = ref<Set<string>>(new Set())
  const proposalExpandedFolders = ref<Set<string>>(new Set())
  const isPageLoading = ref(true)
  const loadingMessage = ref('正在加载书签数据...')

  const normalizeProposalAfterEdit = (): void => {
    updateRef(newProposalTree, draft => {
      draft.children = pruneEmptiedLegacyBookmarksBarFolders(draft.children, originalTree.value)
    })
  }

  const markProposalAsManuallyEdited = (): void => {
    if (!isAIGenerated.value) {
      return
    }
    isAIGenerated.value = false
    logger.info('Management', '提案树已改为手动编辑（取消 AI 标记）')
  }

  /** 提案树变更后的通用副作用 */
  const afterProposalMutation = (options?: { normalize?: boolean }): void => {
    hasUnsavedChanges.value = true
    markProposalAsManuallyEdited()
    if (options?.normalize) {
      normalizeProposalAfterEdit()
    }
  }

  const syncExpandedSetsToSession = async (): Promise<void> => {
    await saveManagementExpandedFolderIds(
      Array.from(originalExpandedFolders.value),
      Array.from(proposalExpandedFolders.value)
    )
  }

  const loadExpandedState = async (): Promise<void> => {
    try {
      const { originalIds, proposalIds } = await loadManagementExpandedFolderIds()

      updateRef(originalExpandedFolders, draft => {
        draft.clear()
        originalIds.forEach(id => draft.add(id))
      })

      updateRef(proposalExpandedFolders, draft => {
        draft.clear()
        proposalIds.forEach(id => draft.add(id))
      })

      logger.debug('BookmarkManagement', '✅ 展开状态已从 session storage 恢复', {
        original: originalExpandedFolders.value.size,
        proposal: proposalExpandedFolders.value.size
      })
    } catch (error) {
      logger.warn('BookmarkManagement', '展开状态加载失败，使用默认值', error)
    }
  }

  loadExpandedState().catch(err => {
    logger.error('BookmarkManagement', '初始化展开状态失败', err)
  })

  const loadBookmarks = async (options?: { preserveProposal?: boolean }) => {
    try {
      isPageLoading.value = true
      loadingMessage.value = '正在加载书签数据...'

      updateRef(originalExpandedFolders, draft => {
        draft.clear()
      })
      if (!options?.preserveProposal) {
        updateRef(proposalExpandedFolders, draft => {
          draft.clear()
        })
      }
      await syncExpandedSetsToSession()

      // 单一权威重载路径，避免与 full-sync 广播触发的 bookmarkStore 自动重载竞态
      await bookmarkStore.loadFromIndexedDB()

      if (!options?.preserveProposal) {
        setProposalTree(bookmarkStore.bookmarkTree)
      }

      logger.info('Management', '✅ 从 IndexedDB 加载书签完成', {
        leftTreeRoots: originalTree.value.length,
        totalRecords: bookmarkStore.nodes.size,
        preserveProposal: Boolean(options?.preserveProposal)
      })
    } catch (error) {
      logger.error('Management', '❌ 从 IndexedDB 加载书签失败', error)
      throw error
    } finally {
      isPageLoading.value = false
    }
  }

  const setProposalTree = (nodes: BookmarkNode[]): void => {
    const normalized = prepareProposalTreeNodes(nodes)

    updateRef(newProposalTree, draft => {
      draft.id = 'root-proposal'
      draft.title = '提案书签树'
      draft.children = normalized
    })

    updateRef(proposalExpandedFolders, draft => {
      draft.clear()
      collectRootFolderIds(normalized).forEach(id => draft.add(id))
    })

    syncExpandedSetsToSession().catch(err => {
      logger.warn('BookmarkManagement', 'setProposalTree 保存展开状态失败', err)
    })
  }

  const setProposalTreeFromRecords = (records: BookmarkRecord[]): void => {
    setProposalTree(treeAppService.buildViewTreeFromFlat(records))
  }

  const moveBookmark = async (data: {
    sourceId: string
    targetId: string
    position: ProposalDropPosition
  }): Promise<{
    nodeId: string
    newParentId: string
    newIndex: number
  } | null> => {
    try {
      logger.debug('moveBookmark', '开始移动', data)

      let moveResult: {
        nodeId: string
        newParentId: string
        newIndex: number
      } | null = null

      updateRef(newProposalTree, draft => {
        moveResult = moveNodeInProposalTree(draft.children, data)
      })

      afterProposalMutation({ normalize: true })
      return moveResult
    } catch (error) {
      logger.error('moveBookmark', '移动节点失败', error)
      throw error
    }
  }

  const bulkDeleteByIds = (ids: string[]): void => {
    if (!Array.isArray(ids) || ids.length === 0) return

    logger.info('Management', '批量删除暂存:', ids)

    let deletedCount = 0
    for (const id of ids) {
      if (deleteNodeFromProposal(id)) {
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      logger.info('Management', `✅ 批量删除完成: ${deletedCount}/${ids.length} 个节点`)
    } else {
      logger.warn('Management', '批量删除失败: 没有节点被删除')
    }
  }

  const deleteNodeFromProposal = (nodeId: string): boolean => {
    try {
      let deleted = false

      updateRef(newProposalTree, draft => {
        deleted = deleteNodeInProposalTree(draft.children, nodeId)
      })

      if (deleted) {
        afterProposalMutation({ normalize: true })
      }

      return deleted
    } catch (error) {
      logger.error('Management', '从提案树删除节点失败', error)
      return false
    }
  }

  const createFolderInProposal = (parentId: string, title = '新建文件夹'): BookmarkNode | null => {
    let created: BookmarkNode | null = null

    updateRef(newProposalTree, draft => {
      created = createFolderInProposalTree(draft.children, parentId, title)
    })

    if (!created) {
      return null
    }

    updateRef(proposalExpandedFolders, draft => {
      draft.add(parentId)
      draft.add(created!.id)
    })
    void syncExpandedSetsToSession()
    afterProposalMutation()

    return created
  }

  const validateCurrentProposalApply = (
    operations: BookmarkOperation[]
  ): ProposalApplyValidationResult => {
    const flatOriginalNodes =
      bookmarkStore.nodes.size > 0 ? bookmarkStore.nodes : new Map<string, BookmarkNode>()
    return validateProposalBeforeApply(
      operations,
      newProposalTree.value.children,
      flatOriginalNodes
    )
  }

  const editNodeInProposal = (data: ProposalEditNodeData): boolean => {
    try {
      let edited = false

      updateRef(newProposalTree, draft => {
        edited = editNodeInProposalTree(draft.children, data)
      })

      if (edited) {
        afterProposalMutation()
      }

      return edited
    } catch (error) {
      logger.error('Management', '编辑提案树节点失败', error)
      return false
    }
  }

  const calculateDiff = (): DiffResult | null => {
    const flatOriginalNodes = bookmarkStore.nodes.size > 0 ? bookmarkStore.nodes : undefined
    return calculateManagementProposalDiff(
      originalTree.value,
      newProposalTree.value.children,
      flatOriginalNodes
    )
  }

  const applyOrganizeProposal = (nodes: BookmarkNode[]): void => {
    setProposalTree(nodes)
    markAsAIGenerated(true)
    hasUnsavedChanges.value = true

    updateRef(proposalExpandedFolders, draft => {
      collectExpandableFolderIds(nodes).forEach(id => draft.add(id))
    })
    void syncExpandedSetsToSession()

    logger.info('Management', 'AI 整理提案已加载到右侧预览')
  }

  const applyChanges = async (
    operations: BookmarkOperation[],
    onProgress?: (current: number, total: number, operation: string) => void
  ): Promise<{
    success: boolean
    errors: Array<{ operation: BookmarkOperation; error: string }>
  }> => {
    const preApplyValidation = validateCurrentProposalApply(operations)
    if (!preApplyValidation.ok) {
      logger.error('Management', '应用前校验未通过，已中止', preApplyValidation.issues)
      return {
        success: false,
        errors: preApplyValidation.issues.map(issue => ({
          operation: {
            type: 'edit',
            nodeId: issue.nodeId ?? 'validation',
            title: issue.message,
            oldTitle: '',
            newTitle: issue.message,
            isFolder: false
          },
          error: issue.message
        }))
      }
    }

    await setBookmarkSyncBatchSuspended(true)

    try {
      isApplyingOwnChanges.value = true

      updateRef(applyProgress, draft => {
        draft.isApplying = true
        draft.currentIndex = 0
        draft.totalOperations = operations.length
        draft.percentage = 0
        draft.errors = []
        draft.currentOperation = '开始应用更改...'
      })

      const applyResult = await proposalApplyService.applyOperations(operations, {
        onProgress: progress => {
          updateRef(applyProgress, draft => {
            draft.currentIndex = progress.current
            draft.percentage = Math.round((progress.current / progress.total) * 100)
            draft.currentOperation = `${progress.operation.type}: ${progress.operationTitle}`
          })
          onProgress?.(progress.current, progress.total, progress.operationTitle)
        }
      })

      const { success: allSucceeded, errors } = applyResult

      await proposalApplyService.requestFullBookmarkSync()
      await loadBookmarks({ preserveProposal: !allSucceeded })

      if (allSucceeded) {
        // 应用成功后右侧提案必须与左侧 IndexedDB 树一致，清除 AI/未保存状态
        setProposalTree(bookmarkStore.bookmarkTree)
        hasUnsavedChanges.value = false
        isAIGenerated.value = false
      } else {
        hasUnsavedChanges.value = true
      }

      updateRef(applyProgress, draft => {
        draft.isApplying = false
        draft.errors = errors
      })

      logger.info(
        'Management',
        allSucceeded ? '✅ 应用更改完成' : '⚠️ 应用更改已中止，已保留提案供重试',
        {
          total: operations.length,
          aborted: !allSucceeded,
          failedNodeId: errors[0]?.operation.nodeId
        }
      )

      isApplyingOwnChanges.value = false

      return { success: allSucceeded, errors }
    } catch (error) {
      logger.error('Management', '应用更改失败', error)

      updateRef(applyProgress, draft => {
        draft.isApplying = false
      })

      isApplyingOwnChanges.value = false
      throw error
    } finally {
      await setBookmarkSyncBatchSuspended(false)
    }
  }

  const markAsAIGenerated = (value: boolean = true): void => {
    isAIGenerated.value = value
    logger.info('Management', `提案树标记为${value ? 'AI生成' : '手动编辑'}`)
  }

  const initialize = async (): Promise<void> => {
    await loadBookmarks()
    logger.info('Management', 'Store 初始化完成')
  }

  return {
    originalTree,
    newProposalTree,
    hasUnsavedChanges,
    originalExpandedFolders,
    proposalExpandedFolders,
    isPageLoading,
    loadingMessage,
    applyProgress,
    isAIGenerated,
    isApplyingOwnChanges,
    loadBookmarks,
    moveBookmark,
    bulkDeleteByIds,
    getProposalPanelTitle: () => getProposalPanelTitle(isAIGenerated.value),
    getProposalPanelIcon: () => getProposalPanelIcon(isAIGenerated.value),
    initialize,
    setProposalTree,
    setProposalTreeFromRecords,
    deleteNodeFromProposal,
    editNodeInProposal,
    createFolderInProposal,
    validateCurrentProposalApply,
    calculateDiff,
    applyChanges,
    markAsAIGenerated,
    applyOrganizeProposal
  }
})
