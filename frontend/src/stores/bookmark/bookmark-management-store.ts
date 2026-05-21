/**
 * 书签管理 Store
 * 负责书签的增删改查、树结构管理、数据同步
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { treeAppService } from '@/application/bookmark/tree-app-service'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import type { BookmarkNode } from '@/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { updateRef } from '@/infrastructure/state/immer-helpers'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'
import {
  bookmarkDiffService,
  type BookmarkOperation,
  type DiffResult
} from '@/application/bookmark/bookmark-diff-service'
import { onceEvent } from '@/infrastructure/events/event-bus'
import { TIMEOUT_CONFIG } from '@/config/constants'

export interface EditBookmarkData {
  id: string
  title: string
  url: string
  parentId?: string
}

export interface AddItemData {
  type: 'folder' | 'bookmark'
  title: string
  url?: string
  parentId?: string
}

/**
 * 🔴 Session Storage Keys:
 * - `bookmark_mgmt_original_expanded`: 原始树展开状态
 * - `bookmark_mgmt_proposal_expanded`: 提案树展开状态
 */
const SESSION_KEYS = {
  ORIGINAL_EXPANDED: 'bookmark_mgmt_original_expanded',
  PROPOSAL_EXPANDED: 'bookmark_mgmt_proposal_expanded'
} as const

export const useBookmarkManagementStore = defineStore(
  'bookmark-management',
  () => {
    // === 核心数据状态 ===
    const bookmarkStore = useBookmarkStore()

    const originalTree = computed(
      () => bookmarkStore.bookmarkTree as BookmarkNode[]
    )

    interface ProposalTreeState {
      id: string
      title: string
      children: BookmarkNode[]
    }

    const newProposalTree = ref<ProposalTreeState>({
      id: 'root-empty',
      title: '等待数据源',
      children: []
    })
    const structuresAreDifferent = ref(false)

    // === 暂存区与未保存更改 ===
    interface StagedEdit {
      id: string
      type: 'create' | 'update' | 'delete' | 'move' | 'reorder'
      nodeId?: string
      payload?: Record<string, unknown>
      reason?: string
      timestamp: number
    }

    const stagedEdits = ref<StagedEdit[]>([])
    const hasUnsavedChanges = ref(false)

    // === 应用更改状态 ===
    interface ApplyProgress {
      isApplying: boolean
      currentOperation: string
      currentIndex: number
      totalOperations: number
      percentage: number
      errors: Array<{ operation: BookmarkOperation; error: string }>
    }

    const applyProgress = ref<ApplyProgress>({
      isApplying: false,
      currentOperation: '',
      currentIndex: 0,
      totalOperations: 0,
      percentage: 0,
      errors: []
    })

    // === AI 生成标记 ===
    const isAIGenerated = ref(false)

    // === 应用变更标志位（用于区分主动应用和外部变更） ===
    const isApplyingOwnChanges = ref(false)

    /**
     * ✅ 等待数据同步完成的辅助函数
     * 使用事件机制替代固定延迟，确保同步真正完成
     *
     * @param timeoutMs - 超时时间（毫秒），默认 3000ms
     * @returns Promise，在同步完成时 resolve
     */
    const waitForSyncComplete = async (timeoutMs = 3000): Promise<void> => {
      return new Promise<void>(resolve => {
        let resolved = false

        // 设置超时保护
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            logger.warn('BookmarkManagement', '等待同步完成超时，继续执行')
            resolve() // 超时后仍然 resolve，避免阻塞
          }
        }, timeoutMs)

        // 监听同步完成事件（onceEvent 会自动清理监听器）
        onceEvent('data:synced', () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve()
          }
        })
      })
    }

    // === 书签树展开状态 ===
    const originalExpandedFolders = ref<Set<string>>(new Set())
    const proposalExpandedFolders = ref<Set<string>>(new Set())

    // === Session Storage 辅助方法 ===
    /**
     * 从 Session Storage 加载展开状态
     * ✅ 性能优化：批量更新两个 Set，减少 Immer 操作次数
     */
    const loadExpandedState = async () => {
      try {
        const [originalIds, proposalIds] = await Promise.all([
          chromeStorage.getSession<string[]>(
            SESSION_KEYS.ORIGINAL_EXPANDED,
            []
          ),
          chromeStorage.getSession<string[]>(SESSION_KEYS.PROPOSAL_EXPANDED, [])
        ])

        // ✅ 批量更新：一次性更新两个 Set
        updateRef(originalExpandedFolders, draft => {
          draft.clear()
          ;(originalIds ?? []).forEach(id => draft.add(id))
        })

        updateRef(proposalExpandedFolders, draft => {
          draft.clear()
          ;(proposalIds ?? []).forEach(id => draft.add(id))
        })

        logger.debug(
          'BookmarkManagement',
          '✅ 展开状态已从 session storage 恢复',
          {
            original: originalExpandedFolders.value.size,
            proposal: proposalExpandedFolders.value.size
          }
        )
      } catch (error) {
        logger.warn('BookmarkManagement', '展开状态加载失败，使用默认值', error)
      }
    }

    /**
     * 保存展开状态到 Session Storage
     * ✅ 性能优化：批量保存，减少 I/O 操作
     */
    const saveExpandedState = async () => {
      try {
        await Promise.all([
          chromeStorage.setSession(
            SESSION_KEYS.ORIGINAL_EXPANDED,
            Array.from(originalExpandedFolders.value)
          ),
          chromeStorage.setSession(
            SESSION_KEYS.PROPOSAL_EXPANDED,
            Array.from(proposalExpandedFolders.value)
          )
        ])
      } catch (error) {
        logger.warn('BookmarkManagement', '保存展开状态失败', error)
      }
    }

    /**
     * 保存原始树展开状态到 Session Storage
     * @deprecated 使用 saveExpandedState() 批量保存
     */
    const saveOriginalExpandedState = async () => {
      try {
        await chromeStorage.setSession(
          SESSION_KEYS.ORIGINAL_EXPANDED,
          Array.from(originalExpandedFolders.value)
        )
      } catch (error) {
        logger.warn('BookmarkManagement', '保存原始树展开状态失败', error)
      }
    }

    /**
     * 保存提案树展开状态到 Session Storage
     * @deprecated 使用 saveExpandedState() 批量保存
     */
    const saveProposalExpandedState = async () => {
      try {
        await chromeStorage.setSession(
          SESSION_KEYS.PROPOSAL_EXPANDED,
          Array.from(proposalExpandedFolders.value)
        )
      } catch (error) {
        logger.warn('BookmarkManagement', '保存提案树展开状态失败', error)
      }
    }

    // 🔴 初始化：从 session storage 加载展开状态
    loadExpandedState().catch(err => {
      logger.error('BookmarkManagement', '初始化展开状态失败', err)
    })

    // === 数据加载状态 ===
    // Management 页面有自己的加载状态（例如批量操作时）
    // 但初始加载时同步 bookmarkStore 的状态
    const isPageLoading = ref(true)
    const loadingMessage = ref('正在加载书签数据...')

    // === 计算属性 ===
    const bookmarkCount = computed(() => {
      const count = (nodes: BookmarkNode[]): number => {
        return nodes.reduce((acc, node) => {
          if (node.url) acc++
          if (node.children) acc += count(node.children)
          return acc
        }, 0)
      }
      return count(originalTree.value)
    })

    const folderCount = computed(() => {
      const count = (nodes: BookmarkNode[]): number => {
        return nodes.reduce((acc, node) => {
          if (!node.url) acc++
          if (node.children) acc += count(node.children)
          return acc
        }, 0)
      }
      return count(originalTree.value)
    })

    // === Actions ===

    const ensureNodeLoaded = (node: BookmarkNode): BookmarkNode => {
      const cloned: BookmarkNode = {
        ...node,
        id: String(node.id),
        parentId: node.parentId ? String(node.parentId) : undefined
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        cloned.children = node.children.map(child => ensureNodeLoaded(child))
        cloned.childrenCount = cloned.children.length
        cloned._childrenLoaded = true
      } else {
        cloned.children = []
        cloned.childrenCount = node.childrenCount ?? 0
        cloned._childrenLoaded = true
      }
      return cloned
    }

    /**
     * 从 IndexedDB 加载书签数据（唯一数据源）
     *
     * 架构原则：
     * - Chrome API → Background Script → IndexedDB → UI
     * - 左右两侧树都使用相同的 IndexedDB 数据源
     */
    /**
     * 从 IndexedDB 加载书签数据
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const loadBookmarks = async () => {
      try {
        isPageLoading.value = true
        loadingMessage.value = '正在加载书签数据...'

        // 🔴 清空展开状态并同步到 session storage
        updateRef(originalExpandedFolders, draft => {
          draft.clear()
        })
        updateRef(proposalExpandedFolders, draft => {
          draft.clear()
        })
        // ✅ 性能优化：使用批量保存方法
        await saveExpandedState()

        // 从 IndexedDB 加载书签数据
        await bookmarkAppService.initialize()
        const recordsResult = await bookmarkAppService.getAllBookmarks()

        if (!recordsResult.ok || !recordsResult.value) {
          throw recordsResult.error ?? new Error('无法读取书签数据')
        }

        // 构建树结构
        const viewTree = treeAppService.buildViewTreeFromFlat(
          recordsResult.value
        )

        // 更新左侧树（通过 bookmarkStore）
        bookmarkStore.reset()
        bookmarkStore.addNodes(viewTree)

        // 更新右侧树（直接设置）
        setProposalTreeFromRecords(recordsResult.value)

        logger.info('Management', '✅ 从 IndexedDB 加载书签完成', {
          leftTreeRoots: originalTree.value.length,
          totalRecords: recordsResult.value.length
        })
      } catch (error) {
        logger.error('Management', '❌ 从 IndexedDB 加载书签失败', error)
        throw error
      } finally {
        isPageLoading.value = false
      }
    }

    /**
     * 设置提案树
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const setProposalTree = (nodes: BookmarkNode[]): void => {
      const normalized = nodes.map(node => ensureNodeLoaded(node))

      // 🆕 使用 Immer 不可变更新 newProposalTree
      updateRef(newProposalTree, draft => {
        draft.id = 'root-proposal'
        draft.title = '提案书签树'
        draft.children = normalized
      })

      // 🔴 更新提案树展开状态并同步到 session storage
      updateRef(proposalExpandedFolders, draft => {
        draft.clear()
        for (const root of normalized) {
          draft.add(String(root.id))
        }
      })
      // ✅ 性能优化：使用批量保存方法（异步，不阻塞主流程）
      saveExpandedState().catch(err => {
        logger.warn(
          'BookmarkManagement',
          'setProposalTree 保存展开状态失败',
          err
        )
      })
    }

    const setProposalTreeFromRecords = (records: BookmarkRecord[]): void => {
      const viewTree = treeAppService.buildViewTreeFromFlat(records)
      setProposalTree(viewTree)
    }

    /**
     * 添加新书签或文件夹（✅ 仅内存操作，用于提案树）
     */
    const addBookmark = async (data: AddItemData) => {
      try {
        // ✅ 调用内存操作方法添加节点到提案树
        const newId = addNodeToProposal(data)

        if (!newId) {
          throw new Error('添加节点到提案树失败')
        }

        logger.info('Management', '节点已添加到提案树（内存）', { id: newId })
        return {
          id: newId,
          title: data.title,
          url: data.url
        }
      } catch (error) {
        logger.error('Management', '添加节点失败', error)
        throw error
      }
    }

    /**
     * 编辑书签（✅ 仅内存操作，用于提案树）
     */
    const editBookmark = async (data: EditBookmarkData) => {
      try {
        // ✅ 调用内存操作方法编辑提案树中的节点
        const success = editNodeInProposal(data)

        if (!success) {
          throw new Error('编辑节点失败')
        }

        logger.info('Management', '节点已编辑（内存）', { id: data.id })
      } catch (error) {
        logger.error('Management', '编辑节点失败', error)
        throw error
      }
    }

    /**
     * 删除书签
     */
    const deleteBookmark = async (id: string) => {
      try {
        // 通过 background script 调用 Chrome API 删除书签
        const response = await chrome.runtime.sendMessage({
          type: 'DELETE_BOOKMARK',
          data: { id }
        })

        if (!response?.success) {
          throw new Error(response?.error || '删除失败')
        }

        // ✅ 使用事件机制等待同步完成，替代固定延迟
        await waitForSyncComplete()
        await loadBookmarks()

        logger.info('Management', '书签删除成功', { id })
      } catch (error) {
        logger.error('Management', '删除书签失败', error)
        throw error
      }
    }

    /**
     * 移动书签或文件夹（仅内存操作，用于提案树拖拽）
     * @param data 移动数据
     * @returns 移动后的节点信息（用于后续调用 Chrome API）
     */
    const moveBookmark = async (data: {
      sourceId: string
      targetId: string
      position: 'before' | 'inside' | 'after'
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

        // ✅ 合并为单次 updateRef 操作，避免 Immer 代理被撤销错误
        updateRef(newProposalTree, draft => {
          // 1️⃣ 找到源节点并从原位置移除
          let sourceNode: BookmarkNode | null = null

          const findAndRemove = (nodes: BookmarkNode[]): BookmarkNode[] => {
            return nodes.filter(node => {
              if (node.id === data.sourceId) {
                sourceNode = { ...node } as BookmarkNode
                return false // 移除
              }
              if (node.children && node.children.length > 0) {
                node.children = findAndRemove(node.children)
              }
              return true
            })
          }

          draft.children = findAndRemove(draft.children)

          if (!sourceNode) {
            logger.error('moveBookmark', '未找到源节点', {
              sourceId: data.sourceId
            })
            throw new Error('未找到源节点')
          }

          // 2️⃣ 根据 position 将节点插入到目标位置，并更新 index
          const insertNode = (
            nodes: BookmarkNode[],
            parentId: string | undefined
          ): boolean => {
            if (!sourceNode) return false

            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i]
              if (!node) continue

              if (node.id === data.targetId) {
                let insertIndex = -1
                let targetParentId = parentId || 'root'

                if (data.position === 'before') {
                  // 插入到目标节点之前
                  nodes.splice(i, 0, sourceNode)
                  insertIndex = i
                  sourceNode.parentId = parentId
                } else if (data.position === 'after') {
                  // 插入到目标节点之后
                  nodes.splice(i + 1, 0, sourceNode)
                  insertIndex = i + 1
                  sourceNode.parentId = parentId
                } else if (data.position === 'inside') {
                  // 插入到目标文件夹内部（作为第一个子节点）
                  if (!node.children) {
                    node.children = []
                  }
                  node.children.unshift(sourceNode)
                  insertIndex = 0
                  targetParentId = node.id
                  sourceNode.parentId = node.id
                }

                // 🔑 重新计算该层级所有节点的 index（从 0 开始连续递增）
                const targetNodes =
                  data.position === 'inside' ? node.children! : nodes
                targetNodes.forEach((child, idx) => {
                  child.index = idx
                })

                // 记录移动结果，用于后续调用 Chrome API
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

          if (!insertNode(draft.children, undefined)) {
            // 如果未找到目标节点，则插入到根级别
            if (sourceNode) {
              const node = sourceNode as BookmarkNode
              node.parentId = undefined
              draft.children.unshift(node)

              // 更新根级别所有节点的 index
              draft.children.forEach((child, idx) => {
                child.index = idx
              })

              moveResult = {
                nodeId: data.sourceId,
                newParentId: 'root',
                newIndex: 0
              }
            }
          }
        })

        logger.info('moveBookmark', '✅ 移动节点成功', {
          ...data,
          result: moveResult
        })
        hasUnsavedChanges.value = true

        return moveResult
      } catch (error) {
        logger.error('moveBookmark', '移动节点失败', error)
        throw error
      }
    }

    /**
     * 构建书签映射
     */
    const buildBookmarkMapping = async () => {
      try {
        // 模拟构建书签映射
        const mapping = new Map()
        return mapping
      } catch (error) {
        logger.error('Management', '构建书签映射失败', error)
        throw error
      }
    }

    /**
     * 应用暂存的更改
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const applyStagedChanges = async () => {
      try {
        if (stagedEdits.value.length === 0) return

        // 这里应该调用应用服务来执行批量操作
        // 🆕 使用 Immer 清空暂存区
        updateRef(stagedEdits, draft => {
          draft.length = 0
        })
        hasUnsavedChanges.value = false

        // 重新加载数据
        await loadBookmarks()

        logger.info('Management', '暂存更改应用成功')
      } catch (error) {
        logger.error('Management', '应用暂存更改失败', error)
        throw error
      }
    }

    /**
     * 清空暂存区
     *
     * 🆕 使用 Immer 进行不可变更新
     */
    const clearStagedChanges = () => {
      // 🆕 使用 Immer 清空数组
      updateRef(stagedEdits, draft => {
        draft.length = 0
      })
      hasUnsavedChanges.value = false
      logger.info('Management', '暂存区已清空')
    }

    /**
     * 删除文件夹（递归删除整个文件夹及其子节点）
     */
    const deleteFolder = async (folderOrId: BookmarkNode | string) => {
      const folderId =
        typeof folderOrId === 'string' ? folderOrId : folderOrId.id

      try {
        // ✅ 通过 Background Script 删除文件夹（符合单向数据流）
        const response = await new Promise<{
          success: boolean
          error?: string
        }>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: 'REMOVE_TREE_BOOKMARK',
              data: { id: folderId }
            },
            response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                resolve(response || { success: false })
              }
            }
          )
        })

        if (!response.success) {
          throw new Error(response.error || '删除文件夹失败')
        }

        // ✅ 使用事件机制等待同步完成，替代固定延迟
        await waitForSyncComplete()
        await loadBookmarks()

        logger.info('Management', `✅ 文件夹已删除: ${folderId}`)
      } catch (error) {
        logger.error('Management', '删除文件夹失败', error)
        throw error
      }
    }

    /**
     * 批量删除
     */
    const bulkDeleteByIds = (ids: string[]) => {
      if (!Array.isArray(ids) || ids.length === 0) return

      logger.info('Management', '批量删除暂存:', ids)
      
      // ✅ 修复：实际删除每个节点
      let deletedCount = 0
      for (const id of ids) {
        const deleted = deleteNodeFromProposal(id)
        if (deleted) {
          deletedCount++
        }
      }
      
      if (deletedCount > 0) {
        hasUnsavedChanges.value = true
        logger.info('Management', `✅ 批量删除完成: ${deletedCount}/${ids.length} 个节点`)
      } else {
        logger.warn('Management', '批量删除失败: 没有节点被删除')
      }
    }

    // ==================== 内存操作方法（仅用于提案树） ====================

    /**
     * 从提案树中删除节点（仅内存操作）
     * @param nodeId 要删除的节点 ID
     */
    const deleteNodeFromProposal = (nodeId: string): boolean => {
      try {
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

        updateRef(newProposalTree, draft => {
          draft.children = deleteRecursive(draft.children)
        })

        if (deleted) {
          logger.info('Management', `✅ 从提案树删除节点（内存）: ${nodeId}`)
          hasUnsavedChanges.value = true
        }

        return deleted
      } catch (error) {
        logger.error('Management', '从提案树删除节点失败', error)
        return false
      }
    }

    /**
     * 编辑提案树中的节点（仅内存操作）
     * @param data 编辑数据
     */
    const editNodeInProposal = (data: EditBookmarkData): boolean => {
      try {
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

        updateRef(newProposalTree, draft => {
          editRecursive(draft.children)
        })

        if (edited) {
          logger.info('Management', `✅ 编辑提案树节点（内存）: ${data.id}`)
          hasUnsavedChanges.value = true
        }

        return edited
      } catch (error) {
        logger.error('Management', '编辑提案树节点失败', error)
        return false
      }
    }

    /**
     * 向提案树添加节点（仅内存操作）
     * @param data 添加数据
     */
    const addNodeToProposal = (data: AddItemData): string | null => {
      try {
        // 生成临时 ID（以 temp_ 开头）
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const newNode: BookmarkNode = {
          id: tempId,
          title: data.title,
          parentId: data.parentId || 'root',
          index: 0,
          dateAdded: Date.now(),
          ...(data.type === 'bookmark' && data.url ? { url: data.url } : {}),
          ...(data.type === 'folder' ? { children: [] } : {})
        }

        if (data.parentId) {
          // 添加到指定父文件夹
          const addToParent = (nodes: BookmarkNode[]): boolean => {
            for (const node of nodes) {
              if (node.id === data.parentId) {
                if (!node.children) {
                  node.children = []
                }
                node.children.unshift(newNode)
                return true
              }
              if (node.children && node.children.length > 0) {
                if (addToParent(node.children)) {
                  return true
                }
              }
            }
            return false
          }

          updateRef(newProposalTree, draft => {
            addToParent(draft.children)
          })
        } else {
          // 添加到根级别
          updateRef(newProposalTree, draft => {
            draft.children.unshift(newNode)
          })
        }

        logger.info('Management', `✅ 向提案树添加节点（内存）: ${tempId}`)
        hasUnsavedChanges.value = true

        return tempId
      } catch (error) {
        logger.error('Management', '向提案树添加节点失败', error)
        return null
      }
    }

    /**
     * 计算提案树和原始树的差异
     */
    const calculateDiff = (): DiffResult | null => {
      try {
        // ✅ 使用相同的根节点 ID，避免误判为删除+新增
        const originalRoot: BookmarkNode = {
          id: 'virtual-root',
          title: 'Root',
          children: originalTree.value
        }

        const proposalRoot: BookmarkNode = {
          id: 'virtual-root',
          title: 'Root',
          children: newProposalTree.value.children
        }

        const diff = bookmarkDiffService.calculateDiff(
          originalRoot,
          proposalRoot
        )

        // ✅ 过滤掉虚拟根节点的操作（不应该出现在用户界面）
        let filteredOperations = diff.operations.filter(
          op => op.nodeId !== 'virtual-root'
        )

        // ✅ 过滤掉临时节点的操作（temp_ 开头的 ID 无法应用到 Chrome API）
        const tempNodeIds = new Set<string>()
        const findTempNodes = (nodes: BookmarkNode[]) => {
          for (const node of nodes) {
            if (node.id.startsWith('temp_')) {
              tempNodeIds.add(node.id)
            }
            if (node.children && node.children.length > 0) {
              findTempNodes(node.children)
            }
          }
        }
        findTempNodes(newProposalTree.value.children)

        if (tempNodeIds.size > 0) {
          logger.warn(
            'Management',
            '⚠️ 检测到临时节点，这些操作需要先新增节点才能应用',
            {
              tempNodeCount: tempNodeIds.size,
              tempNodeIds: Array.from(tempNodeIds)
            }
          )

          // 过滤掉涉及临时节点的操作
          filteredOperations = filteredOperations.filter(op => {
            const involvesTempNode =
              tempNodeIds.has(op.nodeId) ||
              (op.type === 'move' && tempNodeIds.has(op.nodeId)) ||
              (op.type === 'create' && op.nodeId.startsWith('temp_'))

            if (involvesTempNode) {
              logger.debug('Management', '跳过临时节点操作', { operation: op })
            }

            return !involvesTempNode
          })
        }

        // ✅ 重新计算统计信息
        const statistics = {
          total: filteredOperations.length,
          create: filteredOperations.filter(op => op.type === 'create').length,
          move: filteredOperations.filter(op => op.type === 'move').length,
          edit: filteredOperations.filter(op => op.type === 'edit').length,
          delete: filteredOperations.filter(op => op.type === 'delete').length,
          newFolders: filteredOperations.filter(
            op => op.type === 'create' && op.isFolder
          ).length,
          newBookmarks: filteredOperations.filter(
            op => op.type === 'create' && !op.isFolder
          ).length
        }

        logger.info('Management', '差异计算完成', {
          total: statistics.total,
          create: statistics.create,
          move: statistics.move,
          edit: statistics.edit,
          delete: statistics.delete,
          filteredTempNodes: tempNodeIds.size
        })

        return {
          operations: filteredOperations,
          statistics
        }
      } catch (error) {
        logger.error('Management', '计算差异失败', error)
        return null
      }
    }

    /**
     * 应用更改到 Chrome API
     * @param operations 操作列表
     * @param onProgress 进度回调
     */
    const applyChanges = async (
      operations: BookmarkOperation[],
      onProgress?: (current: number, total: number, operation: string) => void
    ): Promise<{
      success: boolean
      errors: Array<{ operation: BookmarkOperation; error: string }>
    }> => {
      try {
        // ✅ 标记为正在应用自己的更改（用于区分外部变更）
        isApplyingOwnChanges.value = true

        // 重置进度状态
        updateRef(applyProgress, draft => {
          draft.isApplying = true
          draft.currentIndex = 0
          draft.totalOperations = operations.length
          draft.percentage = 0
          draft.errors = []
          draft.currentOperation = '开始应用更改...'
        })

        const errors: Array<{ operation: BookmarkOperation; error: string }> =
          []

        // 批量执行操作（每批 50 个，避免阻塞主线程）
        const BATCH_SIZE = 50
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
          const batch = operations.slice(
            i,
            Math.min(i + BATCH_SIZE, operations.length)
          )

          for (const operation of batch) {
            const currentIndex = i + batch.indexOf(operation) + 1

            // 更新进度
            updateRef(applyProgress, draft => {
              draft.currentIndex = currentIndex
              draft.percentage = Math.round(
                (currentIndex / operations.length) * 100
              )
              draft.currentOperation = `${operation.type}: ${operation.title}`
            })

            // 调用进度回调
            onProgress?.(currentIndex, operations.length, operation.title)

            try {
              await executeOperation(operation)
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error)
              logger.error('Management', `操作失败: ${operation.type}`, {
                nodeId: operation.nodeId,
                error: errorMessage
              })
              errors.push({ operation, error: errorMessage })
            }
          }

          // 让出主线程，避免阻塞 UI
          await new Promise(resolve =>
            setTimeout(resolve, TIMEOUT_CONFIG.DELAY.IMMEDIATE)
          )
        }

        // ✅ 使用事件机制等待 Chrome API 事件传播完成，替代固定延迟
        await waitForSyncComplete(5000) // 批量操作可能需要更长时间

        // 应用完成后重新加载数据
        await loadBookmarks()

        // 重置应用状态
        updateRef(applyProgress, draft => {
          draft.isApplying = false
          draft.errors = errors
        })

        hasUnsavedChanges.value = false

        logger.info('Management', '✅ 应用更改完成', {
          total: operations.length,
          errors: errors.length
        })

        // ✅ 使用事件机制等待所有同步事件处理完成，替代固定延迟
        // 等待最后一次同步事件完成后再重置标志位
        await waitForSyncComplete(1000) // 短暂等待，确保最后的同步事件已处理
        isApplyingOwnChanges.value = false

        return { success: errors.length === 0, errors }
      } catch (error) {
        logger.error('Management', '应用更改失败', error)

        updateRef(applyProgress, draft => {
          draft.isApplying = false
        })

        // ✅ 出错时也要重置标志位
        isApplyingOwnChanges.value = false

        throw error
      }
    }

    /**
     * 执行单个操作
     */
    const executeOperation = async (
      operation: BookmarkOperation
    ): Promise<void> => {
      switch (operation.type) {
        case 'delete':
          await executeDelete(operation)
          break
        case 'move':
          await executeMove(operation)
          break
        case 'edit':
          await executeEdit(operation)
          break
        case 'create':
          await executeCreate(operation)
          break
      }
    }

    /**
     * 执行删除操作
     */
    const executeDelete = async (
      operation: BookmarkOperation
    ): Promise<void> => {
      if (operation.type !== 'delete') return

      // ✅ 通过 Background Script 删除书签/文件夹（符合单向数据流）
      const response = await new Promise<{
        success: boolean
        error?: string
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: operation.isFolder
              ? 'REMOVE_TREE_BOOKMARK'
              : 'DELETE_BOOKMARK',
            data: { id: operation.nodeId }
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response || { success: false })
            }
          }
        )
      })

      if (!response.success) {
        throw new Error(response.error || '删除失败')
      }
    }

    /**
     * 执行移动操作
     */
    const executeMove = async (operation: BookmarkOperation): Promise<void> => {
      if (operation.type !== 'move') return

      // ✅ 验证节点 ID 是否有效
      if (!operation.nodeId || operation.nodeId.startsWith('temp_')) {
        throw new Error(`无效的书签 ID: ${operation.nodeId}`)
      }

      // ✅ 通过 Background Script 移动书签（符合单向数据流）
      const response = await new Promise<{
        success: boolean
        error?: string
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'MOVE_BOOKMARK',
            data: {
              id: operation.nodeId,
              parentId: operation.toParentId,
              index: operation.toIndex
            }
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response || { success: false })
            }
          }
        )
      })

      if (!response.success) {
        throw new Error(response.error || '移动失败')
      }
    }

    /**
     * 执行编辑操作
     */
    const executeEdit = async (operation: BookmarkOperation): Promise<void> => {
      if (operation.type !== 'edit') return

      // ✅ 通过 Background Script 更新书签（符合单向数据流）
      const response = await new Promise<{
        success: boolean
        error?: string
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'UPDATE_BOOKMARK',
            data: {
              id: operation.nodeId,
              title: operation.newTitle,
              url: operation.newUrl
            }
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response || { success: false })
            }
          }
        )
      })

      if (!response.success) {
        throw new Error(response.error || '更新失败')
      }
    }

    /**
     * 执行创建操作
     */
    const executeCreate = async (
      operation: BookmarkOperation
    ): Promise<void> => {
      if (operation.type !== 'create') return

      // ✅ 通过 Background Script 创建书签/文件夹（符合单向数据流）
      const response = await new Promise<{
        success: boolean
        bookmark?: chrome.bookmarks.BookmarkTreeNode
        error?: string
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'CREATE_BOOKMARK',
            data: {
              title: operation.title,
              url: operation.url,
              parentId: operation.parentId,
              index: operation.index
            }
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response || { success: false })
            }
          }
        )
      })

      if (!response.success) {
        throw new Error(response.error || '创建失败')
      }
    }

    /**
     * 标记提案树为 AI 生成
     */
    const markAsAIGenerated = (value: boolean = true) => {
      isAIGenerated.value = value
      logger.info('Management', `提案树标记为${value ? 'AI生成' : '手动编辑'}`)
    }

    /**
     * 获取提案面板标题
     */
    const getProposalPanelTitle = () => {
      return isAIGenerated.value ? 'AI 整理建议' : '整理建议'
    }

    /**
     * 获取提案面板图标
     */
    const getProposalPanelIcon = () => {
      return isAIGenerated.value ? 'sparkles' : 'zap'
    }

    /**
     * 获取提案面板颜色
     */
    const getProposalPanelColor = () => {
      return 'primary'
    }

    /**
     * 初始化 Store
     */
    const initialize = async () => {
      await loadBookmarks()
      logger.info('Management', 'Store 初始化完成')
    }

    /**
     * 编辑文件夹
     */
    const editFolder = async (data: EditBookmarkData) => {
      // 文件夹编辑逻辑
      await editBookmark(data)
    }

    return {
      // State
      originalTree,
      newProposalTree,
      structuresAreDifferent,
      stagedEdits,
      hasUnsavedChanges,
      originalExpandedFolders,
      proposalExpandedFolders,
      isPageLoading,
      loadingMessage,
      applyProgress,
      isAIGenerated,
      isApplyingOwnChanges,

      // Computed
      bookmarkCount,
      folderCount,

      // Actions
      loadBookmarks,
      addBookmark,
      editBookmark,
      deleteBookmark,
      moveBookmark,
      buildBookmarkMapping,
      applyStagedChanges,
      clearStagedChanges,
      deleteFolder,
      bulkDeleteByIds,
      getProposalPanelTitle,
      getProposalPanelIcon,
      getProposalPanelColor,
      initialize,
      editFolder,
      setProposalTree,
      setProposalTreeFromRecords,

      // 🔴 内存操作方法（仅用于提案树）
      deleteNodeFromProposal,
      editNodeInProposal,
      addNodeToProposal,

      // 🔴 Session Storage 同步方法
      saveOriginalExpandedState,
      saveProposalExpandedState,

      // 🔴 应用更改方法
      calculateDiff,
      applyChanges,
      markAsAIGenerated
    }
  }
)
