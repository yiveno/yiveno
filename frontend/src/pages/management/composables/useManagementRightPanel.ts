import { computed, ref, type Ref } from 'vue'
import type { BookmarkNode } from '@/types'
import { useNotification } from '@/composables/useNotification'
import { message } from '@/application/message/message-service'
import { logger } from '@/infrastructure/logging/logger'
import { createBookmarkIndex } from '@/application/bookmark/bookmark-index-app-service'
import { t } from '@/utils/i18n-helpers'
import { countSelectedNodes } from '../utils/management-utils'
import type { ProposalDropPosition } from '@/application/bookmark/proposal-tree-move'

interface BookmarkTreeInstance {
  clearSelection?: () => void
}

interface DialogStoreLike {
  openEditFolderDialog(node: BookmarkNode): void
}

interface BookmarkManagementStoreLike {
  createFolderInProposal(parentId: string, title: string): BookmarkNode | null
  moveBookmark(data: {
    sourceId: string
    targetId: string
    position: ProposalDropPosition
  }): Promise<{
    nodeId: string
    newParentId: string
    newIndex: number
  } | null>
  bulkDeleteByIds(ids: string[]): void
}

/**
 * 管理页右侧提案树选择状态与批量操作
 */
export function useManagementRightPanel(options: {
  dialogStore: DialogStoreLike
  bookmarkManagementStore: BookmarkManagementStoreLike
  rightTreeRef: Ref<BookmarkTreeInstance | null>
}) {
  const { dialogStore, bookmarkManagementStore, rightTreeRef } = options
  const notification = useNotification()

  const rightTreeSelectedDescCounts = ref(new Map<string, number>())
  const rightTreeIndex = createBookmarkIndex()
  const rightSelectedIds = ref<string[]>([])
  const isBulkDeleting = ref(false)

  const selectedCounts = computed(() => {
    return countSelectedNodes(rightTreeIndex, rightSelectedIds.value)
  })

  const rightSelectAllState = computed(() => {
    const totalNodes = rightTreeIndex.getAllNodeIds()
    const selectedCount = rightSelectedIds.value.length

    if (selectedCount === 0) {
      return { checked: false, indeterminate: false }
    }

    if (selectedCount === totalNodes.length) {
      return { checked: true, indeterminate: false }
    }

    return { checked: false, indeterminate: true }
  })

  const clearSelectionTooltip = computed(() => {
    if (rightSelectedIds.value.length === 0) {
      return t('management_tooltip_no_selection')
    }
    return t('management_tooltip_clear_selection')
  })

  const deleteButtonTooltip = computed(() => {
    if (selectedCounts.value.bookmarks === 0 && selectedCounts.value.folders === 0) {
      return t('management_tooltip_no_selection')
    }
    const parts: string[] = []
    if (selectedCounts.value.bookmarks > 0) {
      parts.push(`${selectedCounts.value.bookmarks} ${t('management_bookmarks_count')}`)
    }
    if (selectedCounts.value.folders > 0) {
      parts.push(`${selectedCounts.value.folders} ${t('management_folders_count')}`)
    }
    return t('management_tooltip_delete_selected', parts.join('和'))
  })

  function handleRightFolderAdd(parent: BookmarkNode): void {
    const created = bookmarkManagementStore.createFolderInProposal(
      String(parent.id),
      t('management_new_folder_default')
    )
    if (!created) {
      message.error(t('management_create_folder_failed'))
      return
    }
    dialogStore.openEditFolderDialog(created)
  }

  async function handleBookmarkMove(data: {
    sourceId: string
    targetId: string
    position: ProposalDropPosition
  }): Promise<void> {
    logger.info('Management', '🔵 拖拽移动书签开始', { ...data, callTime: Date.now() })
    try {
      const result = await bookmarkManagementStore.moveBookmark(data)
      if (!result) {
        notification.error({
          message: t('management_move_failed'),
          description: t('management_move_failed_retry'),
          duration: 3
        })
        return
      }

      logger.info('Management', '📦 移动结果', {
        nodeId: result.nodeId,
        newParentId: result.newParentId,
        newIndex: result.newIndex
      })
      notification.success({
        message: t('management_bookmark_moved'),
        key: 'bookmark-moved',
        duration: 2
      })
    } catch (error) {
      logger.error('Management', '移动书签失败', error)
      notification.error({
        message: t('management_move_failed'),
        description: t('management_move_failed_retry'),
        duration: 3
      })
    }
  }

  async function handleBulkDelete(): Promise<void> {
    const ids = rightSelectedIds.value.filter(Boolean)
    if (!ids.length || isBulkDeleting.value) return
    isBulkDeleting.value = true
    try {
      bookmarkManagementStore.bulkDeleteByIds(ids)
      try {
        rightTreeRef.value?.clearSelection?.()
      } catch {
        /* ignore */
      }
    } catch (error) {
      logger.error('Management', '批量删除失败', error)
      message.error(t('management_bulk_delete_failed'))
    } finally {
      isBulkDeleting.value = false
    }
  }

  return {
    rightTreeSelectedDescCounts,
    rightTreeIndex,
    rightSelectedIds,
    selectedCounts,
    rightSelectAllState,
    clearSelectionTooltip,
    deleteButtonTooltip,
    handleRightFolderAdd,
    handleBookmarkMove,
    handleBulkDelete
  }
}
