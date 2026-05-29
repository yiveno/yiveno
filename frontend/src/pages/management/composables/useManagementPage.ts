/* eslint-disable require-atomic-updates */
import { computed, nextTick, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialogStore, useBookmarkManagementStore, useTraitFilterStore } from '@/stores'
import type { BookmarkNode } from '@/types'
import { useNotification } from '@/composables/useNotification'
import { useThemeSync } from '@/composables/useThemeSync'
import { message } from '@/application/message/message-service'
import { bookmarkOrganizeService } from '@/application/bookmark/bookmark-organize-service'
import type { OrganizeProgress } from '@/application/bookmark/bookmark-organize-service'
import type {
  BookmarkOperation,
  BookmarkOperationType,
  DiffResult
} from '@/application/bookmark/bookmark-diff-service'
import type { EditBookmarkData } from '@/stores/bookmark/bookmark-management-store'
import { DataValidator } from '@/core/common/store-error'
import { logger } from '@/infrastructure/logging/logger'
import type BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import { createBookmarkIndex } from '@/application/bookmark/bookmark-index-app-service'
import { t } from '@/utils/i18n-helpers'
import { countSelectedNodes, getOperationsByType } from '../utils/management-utils'
import { useManagementLifecycle } from './useManagementLifecycle'
import { useManagementTreeActions } from './useManagementTreeActions'

type BookmarkTreeInstance = InstanceType<typeof BookmarkTree>

/**
 * Management 页面逻辑聚合，负责状态、初始化、筛选、编辑和批量操作。
 */
export function useManagementPage() {
  useThemeSync('Management')

  const dialogStore = useDialogStore()
  const bookmarkManagementStore = useBookmarkManagementStore()
  const traitFilterStore = useTraitFilterStore()
  const notification = useNotification()
  const { getProposalPanelTitle, getProposalPanelIcon, deleteFolder, bulkDeleteByIds } =
    bookmarkManagementStore

  const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(bookmarkManagementStore)
  const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
    storeToRefs(bookmarkManagementStore)

  const showApplyConfirmDialog = ref(false)
  const diffResult = ref<DiffResult | null>(null)
  const applyStartTime = ref(0)

  const isOrganizing = ref(false)
  const organizeProgress = ref<OrganizeProgress>({
    totalStages: 0,
    currentStage: 0,
    stageName: '',
    totalBookmarks: 0,
    processedBookmarks: 0,
    isComplete: false
  })
  const showOrganizeProgress = ref(false)

  const leftSearchResults = ref<BookmarkNode[]>([])
  const isLeftSearchActive = ref(false)
  const rightSearchResults = ref<BookmarkNode[]>([])
  const isRightSearchActive = ref(false)

  const rightTreeSelectedDescCounts = ref(new Map<string, number>())
  const rightTreeIndex = createBookmarkIndex()
  const rightSelectedIds = ref<string[]>([])
  const leftTreeRef = ref<BookmarkTreeInstance | null>(null)
  const rightTreeRef = ref<BookmarkTreeInstance | null>(null)

  const leftExpandAll = ref(false)
  const rightExpandAll = ref(false)
  const isLeftPanelCollapsed = ref(true)
  const leftPanelWidthVar = computed(() => (isLeftPanelCollapsed.value ? '0px' : 'minmax(0, 1fr)'))
  const leftPanelGapVar = computed(() =>
    isLeftPanelCollapsed.value ? '0' : 'clamp(var(--spacing-3), 3vw, var(--spacing-10))'
  )

  const editFormErrors = ref<{ title: string; url: string }>({
    title: '',
    url: ''
  })
  const folderEditFormErrors = ref<{ title: string }>({ title: '' })

  const isEditingBookmark = ref(false)
  const isEditingFolder = ref(false)
  const isDeletingFolder = ref(false)
  const isBulkDeleting = ref(false)

  const isConfirmDeleteDialogOpen = ref(false)
  const deleteTargetFolder = ref<BookmarkNode | null>(null)
  const deleteFolderBookmarkCount = ref(0)

  const rightTreeData = computed(() =>
    isRightSearchActive.value ? rightSearchResults.value : newProposalTree.value.children || []
  )

  const leftTreeData = computed(() =>
    isLeftSearchActive.value ? leftSearchResults.value : originalTree.value
  )

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

  const applyButtonTooltip = computed(() => {
    if (isPageLoading.value) {
      return t('management_tooltip_page_loading')
    }

    if (!bookmarkManagementStore.hasUnsavedChanges) {
      return t('management_tooltip_no_changes')
    }

    return t('management_tooltip_apply_ready')
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

  const MSG_CANCEL_EDIT = t('management_cancel_edit_message')

  function getOperationIcon(type: BookmarkOperationType): string {
    const icons: Record<BookmarkOperationType, string> = {
      create: 'plus',
      move: 'refresh',
      edit: 'edit',
      delete: 'trash'
    }
    return icons[type] || 'bookmark'
  }

  function getOperationTypeText(type: BookmarkOperationType): string {
    const texts: Record<BookmarkOperationType, string> = {
      create: '新增',
      move: '移动',
      edit: '编辑',
      delete: '删除'
    }
    return texts[type] || type
  }

  const applyConfirmTitle = computed(() => {
    if (!diffResult.value) return t('management_apply')

    const total = diffResult.value.statistics.total
    if (total < 100) {
      return t('management_confirm_apply_changes')
    } else if (total < 500) {
      return '⚠️ ' + t('management_confirm_apply_changes')
    } else {
      return '⚠️ ' + t('management_large_operation_warning')
    }
  })

  const applyConfirmIcon = computed(() => {
    if (!diffResult.value) return 'icon-check'

    const total = diffResult.value.statistics.total
    if (total < 100) {
      return 'icon-check'
    }
    return 'icon-warning'
  })

  const estimatedRemainingTime = computed(() => {
    const progress = bookmarkManagementStore.applyProgress
    if (!progress.isApplying || progress.currentIndex === 0) {
      return t('management_calculating')
    }

    const elapsed = Date.now() - applyStartTime.value
    const avgTimePerOp = elapsed / progress.currentIndex
    const remaining = Math.ceil(
      ((progress.totalOperations - progress.currentIndex) * avgTimePerOp) / 1000
    )

    if (remaining < 60) {
      return t('management_about_seconds', String(remaining))
    }
    const minutes = Math.ceil(remaining / 60)
    return t('management_about_minutes', String(minutes))
  })

  function getOperationsByDiffType(type: BookmarkOperationType): BookmarkOperation[] {
    if (!diffResult.value) return []
    return getOperationsByType(diffResult.value.operations, type)
  }

  function getDiffOperationsByType(type: BookmarkOperationType): BookmarkOperation[] {
    return getOperationsByDiffType(type)
  }

  const { pendingTagSelection } = useManagementLifecycle({
    bookmarkManagementStore,
    traitFilterStore,
    rightTreeIndex,
    rightTreeData,
    originalTree,
    isPageLoading,
    loadingMessage,
    leftTreeRef,
    rightTreeRef,
    clearRightSelection: () => {
      try {
        rightTreeRef.value?.clearSelection?.()
      } catch {
        /* ignore */
      }
    }
  })
  const {
    clearRightSelection,
    handleLeftSearch,
    handleLeftSearchClear,
    handleRightSearch,
    handleRightSearchClear,
    onEditBookmarkTitleInput,
    onEditBookmarkUrlInput,
    onEditFolderTitleInput,
    handleLeftTreeReady,
    handleRightNodeEdit,
    handleRightNodeDelete,
    toggleLeftPanel,
    toggleLeftExpandAll,
    toggleRightExpandAll,
    onRightSelectionChange,
    toggleRightSelectAll,
    handleBookmarkCopyUrl,
    handleBookmarkOpenNewTab,
    getAllRightTreeNodeIds
  } = useManagementTreeActions({
    dialogStore,
    bookmarkManagementStore,
    rightTreeIndex,
    rightTreeRef,
    leftTreeRef,
    originalTree,
    leftExpandAll,
    rightExpandAll,
    isLeftPanelCollapsed,
    isPageLoading,
    loadingMessage,
    leftSearchResults,
    rightSearchResults,
    isLeftSearchActive,
    isRightSearchActive,
    rightSelectedIds
  })

  function handleApplyClick(): void {
    const tempNodeInfo = getTempNodesInfo(bookmarkManagementStore.newProposalTree.children)
    if (tempNodeInfo.count > 0) {
      const confirmText =
        `⚠️ 检测到 ${tempNodeInfo.count} 个未保存的新增节点。\n\n` +
        `说明：新添加的节点（ID 以 temp_ 开头）尚未保存到浏览器书签。\n` +
        `这些节点的顺序调整无法应用，因为它们还不存在于浏览器中。\n\n` +
        `建议操作流程：\n` +
        `1. 如果这些是误添加的节点，请刷新页面丢弃它们\n` +
        `2. 如果需要保留这些节点，暂时不支持保存（功能开发中）`
      const shouldContinue = typeof window !== 'undefined' ? window.confirm(confirmText) : false
      if (!shouldContinue) return
    }

    const diff = bookmarkManagementStore.calculateDiff()
    if (!diff || diff.statistics.total === 0) {
      bookmarkManagementStore.hasUnsavedChanges = false
      message.info(t('management_no_changes_detected'))
      return
    }
    diffResult.value = diff
    showApplyConfirmDialog.value = true
  }

  function getTempNodesInfo(_nodes: BookmarkNode[]): { count: number; ids: string[] } {
    const allIds = rightTreeIndex.getAllNodeIds()
    const tempIds = allIds.filter(id => id.startsWith('temp_'))
    return { count: tempIds.length, ids: tempIds }
  }

  async function confirmApplyChanges(): Promise<void> {
    if (!diffResult.value) return

    try {
      showApplyConfirmDialog.value = false
      applyStartTime.value = Date.now()

      const result = await bookmarkManagementStore.applyChanges(
        diffResult.value.operations,
        (current, total, operation) => {
          logger.debug('Management', `应用进度: ${current}/${total}`, {
            operation
          })
        }
      )

      if (result.success) {
        message.success(t('management_all_changes_applied'))
      } else {
        message.warning(t('management_some_changes_failed', String(result.errors.length)))
        logger.error('Management', '应用更改部分失败', result.errors)
      }

      diffResult.value = null
    } catch (error) {
      logger.error('Management', '应用更改失败', error)
      message.error(t('management_apply_changes_failed'))
    }
  }

  async function handleAutoOrganize(): Promise<void> {
    if (isOrganizing.value) return

    isOrganizing.value = true
    showOrganizeProgress.value = true

    try {
      logger.info('Management', '开始一键整理书签')

      const result = await bookmarkOrganizeService.organizeBookmarks(progress => {
        organizeProgress.value = progress
      })

      logger.info('Management', '文件夹结构生成完成', result)

      await bookmarkOrganizeService.applyOrganization(result.folders, progress => {
        organizeProgress.value = progress
      })

      message.success(
        `整理完成：${result.organizedCount}/${result.originalCount} 个书签已分类，${result.folders.length} 个文件夹`
      )

      logger.info('Management', '一键整理完成', result)
    } catch (error) {
      logger.error('Management', '一键整理失败', error)
      message.error('AI 整理失败，请检查 LLM 配置')
    } finally {
      isOrganizing.value = false
      showOrganizeProgress.value = false
    }
  }

  async function confirmEditBookmark(): Promise<void> {
    if (!isEditDirty.value) {
      dialogStore.closeEditBookmarkDialog()
      return
    }
    const title = (dialogStore.editBookmarkDialog.title || '').trim()
    if (!title) {
      editFormErrors.value.title = t('management_title_required')
      return
    }
    const url = (dialogStore.editBookmarkDialog.url || '').trim()
    if (!DataValidator.validateUrl(url)) {
      editFormErrors.value.url = t('management_url_invalid')
      return
    }
    if (isEditingBookmark.value) return

    isEditingBookmark.value = true
    try {
      const editData: EditBookmarkData = {
        id: dialogStore.editBookmarkDialog.bookmark!.id,
        title: dialogStore.editBookmarkDialog.title,
        url: dialogStore.editBookmarkDialog.url
      }
      if (dialogStore.editBookmarkDialog.parentId) {
        editData.parentId = dialogStore.editBookmarkDialog.parentId
      }
      await bookmarkManagementStore.editBookmark(editData)
      dialogStore.closeEditBookmarkDialog()
      await nextTick()
      message.success(t('management_bookmark_updated'))
    } catch (error) {
      logger.error('Management', 'Edit', '编辑书签失败', error)
      message.error(t('management_edit_failed'))
    } finally {
      isEditingBookmark.value = false
    }
  }

  const isEditDirty = computed(() => {
    const originalTitle = (dialogStore.editBookmarkDialog.bookmark?.title || '').trim()
    const originalUrl = (dialogStore.editBookmarkDialog.bookmark?.url || '').trim()
    const curTitle = (dialogStore.editBookmarkDialog.title || '').trim()
    const curUrl = (dialogStore.editBookmarkDialog.url || '').trim()
    return originalTitle !== curTitle || originalUrl !== curUrl
  })

  const isEditFolderDirty = computed(() => {
    const originalTitle = (dialogStore.editFolderDialog.folder?.title || '').trim()
    const curTitle = (dialogStore.editFolderDialog.title || '').trim()
    return originalTitle !== curTitle
  })

  async function confirmEditFolder(): Promise<void> {
    if (!isEditFolderDirty.value) {
      dialogStore.closeEditFolderDialog()
      return
    }
    const title = (dialogStore.editFolderDialog.title || '').trim()
    if (!title) {
      folderEditFormErrors.value.title = t('management_title_required')
      return
    }
    if (isEditingFolder.value) return

    isEditingFolder.value = true
    try {
      await bookmarkManagementStore.editBookmark({
        id: dialogStore.editFolderDialog.folder!.id,
        title: dialogStore.editFolderDialog.title,
        url: ''
      })
      dialogStore.closeEditFolderDialog()
      await nextTick()
      message.success(t('management_folder_updated'))
    } catch (error) {
      logger.error('Management', 'Edit', '编辑文件夹失败', error)
      message.error(t('management_edit_failed'))
    } finally {
      isEditingFolder.value = false
    }
  }

  async function confirmDeleteFolder(): Promise<void> {
    if (deleteTargetFolder.value && !isDeletingFolder.value) {
      isDeletingFolder.value = true
      try {
        await deleteFolder(deleteTargetFolder.value.id)
      } catch (error) {
        logger.error('Management', '删除文件夹失败', error)
        message.error(t('management_delete_failed'))
      } finally {
        isDeletingFolder.value = false
      }
    }
    isConfirmDeleteDialogOpen.value = false
    deleteTargetFolder.value = null
    deleteFolderBookmarkCount.value = 0
  }

  async function handleBookmarkMove(data: {
    sourceId: string
    targetId: string
    position: 'before' | 'inside' | 'after'
  }): Promise<void> {
    logger.info('Management', '🔵 拖拽移动书签开始', { ...data, callTime: Date.now() })
    try {
      const result = await bookmarkManagementStore.moveBookmark(data)
      if (result) {
        logger.info('Management', '📦 移动结果', {
          nodeId: result.nodeId,
          newParentId: result.newParentId,
          newIndex: result.newIndex
        })
      }
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
      bulkDeleteByIds(ids)
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
    dialogStore,
    bookmarkManagementStore,
    traitFilterStore,
    getProposalPanelTitle,
    getProposalPanelIcon,
    originalTree,
    newProposalTree,
    isPageLoading,
    loadingMessage,
    originalExpandedFolders,
    proposalExpandedFolders,
    showApplyConfirmDialog,
    diffResult,
    applyStartTime,
    isOrganizing,
    organizeProgress,
    showOrganizeProgress,
    leftSearchResults,
    rightSearchResults,
    isLeftSearchActive,
    isRightSearchActive,
    leftTreeData,
    rightTreeData,
    leftTreeRef,
    rightTreeRef,
    leftExpandAll,
    rightExpandAll,
    isLeftPanelCollapsed,
    rightTreeSelectedDescCounts,
    rightSelectedIds,
    rightSelectAllState,
    selectedCounts,
    applyButtonTooltip,
    clearSelectionTooltip,
    deleteButtonTooltip,
    applyConfirmTitle,
    applyConfirmIcon,
    estimatedRemainingTime,
    MSG_CANCEL_EDIT,
    editFormErrors,
    folderEditFormErrors,
    isEditingBookmark,
    isEditingFolder,
    isDeletingFolder,
    isBulkDeleting,
    isConfirmDeleteDialogOpen,
    deleteTargetFolder,
    deleteFolderBookmarkCount,
    isEditDirty,
    isEditFolderDirty,
    handleLeftSearch,
    handleLeftSearchClear,
    handleRightSearch,
    handleRightSearchClear,
    onEditBookmarkTitleInput,
    onEditBookmarkUrlInput,
    onEditFolderTitleInput,
    handleLeftTreeReady,
    handleRightNodeEdit,
    handleRightNodeDelete,
    toggleLeftPanel,
    toggleLeftExpandAll,
    toggleRightExpandAll,
    onRightSelectionChange,
    toggleRightSelectAll,
    clearRightSelection,
    getAllRightTreeNodeIds,
    handleBookmarkCopyUrl,
    handleBookmarkOpenNewTab,
    handleApplyClick,
    getTempNodesInfo,
    confirmApplyChanges,
    handleAutoOrganize,
    confirmEditBookmark,
    confirmEditFolder,
    confirmDeleteFolder,
    handleBookmarkMove,
    handleBulkDelete,
    leftPanelWidthVar,
    leftPanelGapVar,
    getOperationIcon,
    getOperationTypeText,
    pendingTagSelection,
    getOperationsByDiffType,
    getDiffOperationsByType
  }
}
