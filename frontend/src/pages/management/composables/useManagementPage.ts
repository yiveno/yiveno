/* eslint-disable require-atomic-updates */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialogStore, useBookmarkManagementStore, useTraitFilterStore } from '@/stores'
import type { BookmarkNode } from '@/types'
import { useNotification } from '@/composables/useNotification'
import { useSubscription } from '@/composables/useSubscription'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { useThemeSync } from '@/composables/useThemeSync'
import { detectAiEngineUiReady } from '@/application/ai/ai-engine-availability'
import { message } from '@/application/message/message-service'
import { bookmarkOrganizeService } from '@/application/bookmark/bookmark-organize-service'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import type { OrganizeProgress } from '@/application/bookmark/bookmark-organize-service'
import { createInitialOrganizeProgress } from '@/core/bookmark/organize-progress'
import type {
  BookmarkOperation,
  BookmarkOperationType,
  DiffResult
} from '@/application/bookmark/bookmark-diff-service'
import type { EditBookmarkData } from '@/stores/bookmark-management-store'
import { DataValidator } from '@/core/common/store-error'
import { logger } from '@/infrastructure/logging/logger'
import type BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import { createBookmarkIndex } from '@/application/bookmark/bookmark-index-app-service'
import { t } from '@/utils/i18n-helpers'
import { countSelectedNodes, getOperationsByType } from '../utils/management-utils'
import { useManagementLifecycle } from './useManagementLifecycle'
import { useManagementTreeActions } from './useManagementTreeActions'
import { useManagementUnifiedSearch } from './useManagementUnifiedSearch'
import {
  AI_ONE_CLICK_ORGANIZE_STORAGE_KEY,
  isAiOneClickOrganizeEnabled
} from '@/core/ai/ai-feature-settings'

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
  const { isPro } = useSubscription()
  const { isAuthenticated } = useSupabaseAuth()
  const aiOneClickOrganizeEnabled = ref(true)
  const aiEngineReady = ref(false)
  const { getProposalPanelTitle, getProposalPanelIcon, deleteFolder, bulkDeleteByIds } =
    bookmarkManagementStore

  const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(bookmarkManagementStore)
  const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
    storeToRefs(bookmarkManagementStore)

  const showApplyConfirmDialog = ref(false)
  const diffResult = ref<DiffResult | null>(null)
  const applyStartTime = ref(0)

  const isOrganizing = ref(false)
  const organizeProgress = ref<OrganizeProgress>(createInitialOrganizeProgress())
  const showOrganizeProgress = ref(false)
  const showOrganizeNotesDialog = ref(false)
  const organizeUserNotes = ref('')
  const ORGANIZE_USER_NOTES_MAX_LENGTH = 500

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

  const proposalTreeChildren = computed(() => newProposalTree.value.children || [])

  const {
    leftTreeData,
    rightTreeData,
    leftMatchCount,
    rightMatchCount,
    isLeftFiltered,
    isRightFiltered,
    isUnifiedSearchActive,
    isUnifiedSearchFiltering,
    handleFilterRequest,
    clearUnifiedSearch
  } = useManagementUnifiedSearch({
    originalTree,
    proposalTreeChildren,
    leftTreeRef,
    rightTreeRef,
    leftExpandAll,
    rightExpandAll
  })

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

  const showOneClickOrganizeButton = computed(
    () => isPro.value && aiOneClickOrganizeEnabled.value && aiEngineReady.value
  )

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

  async function loadOneClickOrganizeSetting(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(AI_ONE_CLICK_ORGANIZE_STORAGE_KEY)
      aiOneClickOrganizeEnabled.value = isAiOneClickOrganizeEnabled(
        result[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]
      )
    } catch (error) {
      logger.error('Management', '加载一键整理设置失败', error)
    }
  }

  async function refreshAIEngineReady(): Promise<void> {
    try {
      llmAdapter.clearCapabilitiesCache()
      aiEngineReady.value = await detectAiEngineUiReady({
        isPro: isPro.value,
        isLoggedIn: isAuthenticated.value
      })
    } catch (error) {
      logger.error('Management', '检测 AI 引擎状态失败', error)
      aiEngineReady.value = false
    }
  }

  const storageListener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== 'local') return

    if (changes[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]) {
      aiOneClickOrganizeEnabled.value = isAiOneClickOrganizeEnabled(
        changes[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY].newValue
      )
    }

    if (changes.USER_AI_CONFIG) {
      void refreshAIEngineReady()
    }
  }

  onMounted(() => {
    void loadOneClickOrganizeSetting()
    void refreshAIEngineReady()
    chrome.storage.onChanged.addListener(storageListener)
  })

  watch([isPro, isAuthenticated], () => {
    void refreshAIEngineReady()
  })

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(storageListener)
  })

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
    rightSelectedIds
  })

  function handleApplyClick(): void {
    const diff = bookmarkManagementStore.calculateDiff()
    if (!diff || diff.statistics.total === 0) {
      bookmarkManagementStore.hasUnsavedChanges = false
      message.info(t('management_no_changes_detected'))
      return
    }

    const validation = bookmarkManagementStore.validateCurrentProposalApply(diff.operations)
    if (!validation.ok) {
      logger.error('Management', '提案应用前校验失败', validation.issues)
      message.error(t('management_apply_validation_failed'))
      return
    }

    diffResult.value = diff
    showApplyConfirmDialog.value = true
  }

  async function confirmApplyChanges(): Promise<void> {
    try {
      showApplyConfirmDialog.value = false
      applyStartTime.value = Date.now()

      // 执行前重算 diff，避免确认期间左侧树变化导致过期操作
      const freshDiff = bookmarkManagementStore.calculateDiff()
      if (!freshDiff || freshDiff.statistics.total === 0) {
        bookmarkManagementStore.hasUnsavedChanges = false
        message.info(t('management_no_changes_detected'))
        diffResult.value = null
        return
      }

      const validation = bookmarkManagementStore.validateCurrentProposalApply(freshDiff.operations)
      if (!validation.ok) {
        logger.error('Management', '提案应用前校验失败', validation.issues)
        message.error(t('management_apply_validation_failed'))
        diffResult.value = null
        return
      }

      const result = await bookmarkManagementStore.applyChanges(
        freshDiff.operations,
        (current, total, operation) => {
          logger.debug('Management', `应用进度: ${current}/${total}`, {
            operation
          })
        }
      )

      if (result.success) {
        message.success(t('management_all_changes_applied'))
        bookmarkManagementStore.markAsAIGenerated(false)
      } else {
        logger.error('Management', '应用更改失败', result.errors)
        message.error(t('management_apply_changes_failed'))
      }

      diffResult.value = null
    } catch (error) {
      logger.error('Management', '应用更改失败', error)
      message.error(t('management_apply_changes_failed'))
    }
  }

  function handleAutoOrganize(): void {
    if (isOrganizing.value) return
    showOrganizeNotesDialog.value = true
  }

  function closeOrganizeNotesDialog(): void {
    showOrganizeNotesDialog.value = false
  }

  async function confirmStartOrganize(): Promise<void> {
    if (isOrganizing.value) return

    const userNotes = organizeUserNotes.value.trim()
    showOrganizeNotesDialog.value = false
    await runAutoOrganize(userNotes)
  }

  async function runAutoOrganize(userNotes?: string): Promise<void> {
    if (isOrganizing.value) return

    isOrganizing.value = true
    organizeProgress.value = createInitialOrganizeProgress()
    showOrganizeProgress.value = true

    try {
      await bookmarkOrganizeService.ensureLlmReady()
      logger.info('Management', '开始一键整理书签', {
        hasUserNotes: Boolean(userNotes)
      })

      const result = await bookmarkOrganizeService.organizeBookmarks(
        progress => {
          organizeProgress.value = progress
        },
        userNotes ? { userNotes } : undefined
      )

      const proposalTree = bookmarkOrganizeService.buildValidatedProposalPreview(
        originalTree.value,
        result
      )

      bookmarkManagementStore.applyOrganizeProposal(proposalTree)

      isLeftPanelCollapsed.value = false

      message.success(t('management_organize_success'))

      logger.info('Management', 'AI 整理提案已生成', result)
    } catch (error) {
      logger.error('Management', '一键整理失败', error)
      message.error(t('management_organize_failed_retry'))
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
    showOneClickOrganizeButton,
    isOrganizing,
    organizeProgress,
    showOrganizeProgress,
    showOrganizeNotesDialog,
    organizeUserNotes,
    ORGANIZE_USER_NOTES_MAX_LENGTH,
    leftTreeData,
    rightTreeData,
    leftMatchCount,
    rightMatchCount,
    isLeftFiltered,
    isRightFiltered,
    isUnifiedSearchActive,
    isUnifiedSearchFiltering,
    handleFilterRequest,
    clearUnifiedSearch,
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
    confirmApplyChanges,
    handleAutoOrganize,
    closeOrganizeNotesDialog,
    confirmStartOrganize,
    confirmEditBookmark,
    confirmEditFolder,
    confirmDeleteFolder,
    handleRightFolderAdd,
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
