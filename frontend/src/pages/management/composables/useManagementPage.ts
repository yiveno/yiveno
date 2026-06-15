import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialogStore, useBookmarkManagementStore, useTraitFilterStore } from '@/stores'
import { useThemeSync } from '@/composables/useThemeSync'
import type BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import { useManagementLifecycle } from './useManagementLifecycle'
import { useManagementTreeActions } from './useManagementTreeActions'
import { useManagementUnifiedSearch } from './useManagementUnifiedSearch'
import { useManagementTreeExpand } from './useManagementTreeExpand'
import { useManagementAiSettings } from './useManagementAiSettings'
import { useManagementApplyFlow } from './useManagementApplyFlow'
import { useManagementOrganize } from './useManagementOrganize'
import { useManagementEditDialogs } from './useManagementEditDialogs'
import { useManagementRightPanel } from './useManagementRightPanel'

type BookmarkTreeInstance = InstanceType<typeof BookmarkTree>

interface UseManagementPageOptions {
  leftTreeRef: Ref<BookmarkTreeInstance | null>
  rightTreeRef: Ref<BookmarkTreeInstance | null>
}

/**
 * Management 页面逻辑聚合，编排各子 composable。
 */
export function useManagementPage(options: UseManagementPageOptions) {
  useThemeSync('Management')

  const dialogStore = useDialogStore()
  const bookmarkManagementStore = useBookmarkManagementStore()
  const traitFilterStore = useTraitFilterStore()
  const { getProposalPanelTitle, getProposalPanelIcon } = bookmarkManagementStore
  const { leftTreeRef, rightTreeRef } = options

  const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(bookmarkManagementStore)
  const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
    storeToRefs(bookmarkManagementStore)

  const {
    leftExpandAll,
    rightExpandAll,
    leftExpandCommand,
    leftExpandCommandExpanded,
    rightExpandCommand,
    rightExpandCommandExpanded,
    isLeftPanelCollapsed,
    isLeftTreeExpanded,
    isRightTreeExpanded,
    leftPanelWidthVar,
    leftPanelGapVar,
    setLeftTreeExpanded,
    setRightTreeExpanded,
    handleLeftExpandStateChange,
    handleRightExpandStateChange
  } = useManagementTreeExpand()

  const { showOneClickOrganizeButton } = useManagementAiSettings()

  const proposalTreeChildren = computed(() => newProposalTree.value.children || [])

  const {
    leftTreeData,
    rightTreeData,
    leftMatchCount,
    rightMatchCount,
    isLeftFiltered,
    isRightFiltered,
    isUnifiedSearchFiltering,
    handleFilterRequest,
    clearUnifiedSearch
  } = useManagementUnifiedSearch({
    originalTree,
    proposalTreeChildren,
    leftExpandAll,
    rightExpandAll,
    setLeftTreeExpanded,
    setRightTreeExpanded
  })

  const {
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
  } = useManagementRightPanel({
    dialogStore,
    bookmarkManagementStore,
    rightTreeRef
  })

  const {
    showApplyConfirmDialog,
    diffResult,
    applyButtonTooltip,
    applyConfirmTitle,
    applyConfirmIcon,
    estimatedRemainingTime,
    getOperationIcon,
    getOperationTypeText,
    getOperationsByDiffType,
    handleApplyClick,
    confirmApplyChanges
  } = useManagementApplyFlow(bookmarkManagementStore, isPageLoading, clearUnifiedSearch)

  const {
    isOrganizing,
    organizeProgress,
    showOrganizeProgress,
    showOrganizeNotesDialog,
    organizeUserNotes,
    organizeRemoveDuplicates,
    organizeRemoveInvalid,
    ORGANIZE_USER_NOTES_MAX_LENGTH,
    handleAutoOrganize,
    closeOrganizeNotesDialog,
    confirmStartOrganize
  } = useManagementOrganize({
    bookmarkManagementStore,
    originalTree,
    isLeftPanelCollapsed
  })

  const {
    editFormErrors,
    folderEditFormErrors,
    isEditingBookmark,
    isEditingFolder,
    isEditDirty,
    isEditFolderDirty,
    MSG_CANCEL_EDIT,
    confirmEditBookmark,
    confirmEditFolder
  } = useManagementEditDialogs({
    dialogStore,
    bookmarkManagementStore
  })

  useManagementLifecycle({
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
    handleBookmarkOpenNewTab
  } = useManagementTreeActions({
    dialogStore,
    bookmarkManagementStore,
    rightTreeIndex,
    rightTreeRef,
    leftTreeRef,
    originalTree,
    leftExpandAll,
    rightExpandAll,
    leftExpandCommandExpanded,
    rightExpandCommandExpanded,
    setLeftTreeExpanded,
    setRightTreeExpanded,
    isLeftPanelCollapsed,
    isPageLoading,
    loadingMessage,
    rightSelectedIds
  })

  return {
    dialogStore,
    bookmarkManagementStore,
    getProposalPanelTitle,
    getProposalPanelIcon,
    isPageLoading,
    loadingMessage,
    originalExpandedFolders,
    proposalExpandedFolders,
    showApplyConfirmDialog,
    diffResult,
    showOneClickOrganizeButton,
    isOrganizing,
    organizeProgress,
    showOrganizeProgress,
    showOrganizeNotesDialog,
    organizeUserNotes,
    organizeRemoveDuplicates,
    organizeRemoveInvalid,
    ORGANIZE_USER_NOTES_MAX_LENGTH,
    proposalTreeChildren,
    leftTreeData,
    rightTreeData,
    leftMatchCount,
    rightMatchCount,
    isLeftFiltered,
    isRightFiltered,
    isUnifiedSearchFiltering,
    handleFilterRequest,
    clearUnifiedSearch,
    leftExpandAll,
    rightExpandAll,
    leftExpandCommand,
    leftExpandCommandExpanded,
    rightExpandCommand,
    rightExpandCommandExpanded,
    isLeftTreeExpanded,
    isRightTreeExpanded,
    handleLeftExpandStateChange,
    handleRightExpandStateChange,
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
    handleBookmarkCopyUrl,
    handleBookmarkOpenNewTab,
    handleApplyClick,
    confirmApplyChanges,
    handleAutoOrganize,
    closeOrganizeNotesDialog,
    confirmStartOrganize,
    confirmEditBookmark,
    confirmEditFolder,
    handleRightFolderAdd,
    handleBookmarkMove,
    handleBulkDelete,
    leftPanelWidthVar,
    leftPanelGapVar,
    getOperationIcon,
    getOperationTypeText,
    getOperationsByDiffType
  }
}
