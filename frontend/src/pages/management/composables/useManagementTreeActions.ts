import { ref, type Ref } from 'vue'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import { message } from '@/application/message/message-service'
import { isInternalProtocolUrl, readMwcTextFieldValue } from '../utils/management-utils'
import { t } from '@/utils/i18n-helpers'

interface BookmarkTreeInstance {
  clearSelection?: () => void
  selectNodesByIds?: (ids: string[], options?: { append?: boolean }) => void
}

interface UseManagementTreeActionsOptions {
  dialogStore: {
    editBookmarkDialog: {
      title: string
      url: string
    }
    editFolderDialog: {
      title: string
    }
    openEditBookmarkDialog: (node: BookmarkNode) => void
    openEditFolderDialog: (node: BookmarkNode) => void
  }
  bookmarkManagementStore: {
    deleteNodeFromProposal: (id: string) => boolean
  }
  rightTreeIndex: {
    getAllNodeIds(): string[]
  }
  rightTreeRef: Ref<BookmarkTreeInstance | null>
  leftTreeRef: Ref<BookmarkTreeInstance | null>
  originalTree: Ref<BookmarkNode[]>
  leftExpandAll: Ref<boolean>
  rightExpandAll: Ref<boolean>
  leftExpandCommandExpanded: Ref<boolean>
  rightExpandCommandExpanded: Ref<boolean>
  setLeftTreeExpanded: (expanded: boolean) => void
  setRightTreeExpanded: (expanded: boolean) => void
  isLeftPanelCollapsed: Ref<boolean>
  isPageLoading: Ref<boolean>
  loadingMessage: Ref<string>
  rightSelectedIds: Ref<string[]>
}

export function useManagementTreeActions(options: UseManagementTreeActionsOptions): {
  clearRightSelection: () => void
  onEditBookmarkTitleInput: (ev: Event) => void
  onEditBookmarkUrlInput: (ev: Event) => void
  onEditFolderTitleInput: (ev: Event) => void
  handleLeftTreeReady: () => void
  handleRightNodeEdit: (node: BookmarkNode) => void
  handleRightNodeDelete: (node: BookmarkNode) => void
  toggleLeftPanel: () => void
  toggleLeftExpandAll: () => void
  toggleRightExpandAll: () => void
  onRightSelectionChange: (ids: string[]) => void
  toggleRightSelectAll: (checked: boolean) => void
  handleBookmarkCopyUrl: (node: BookmarkNode) => void
  handleBookmarkOpenNewTab: (node: BookmarkNode) => void
} {
  const isLeftExpanding = ref(false)
  const isRightExpanding = ref(false)

  function clearRightSelection(): void {
    try {
      options.rightTreeRef.value?.clearSelection?.()
    } catch {
      /* ignore */
    }
  }

  function onEditBookmarkTitleInput(ev: Event): void {
    options.dialogStore.editBookmarkDialog.title = readMwcTextFieldValue(ev)
  }

  function onEditBookmarkUrlInput(ev: Event): void {
    options.dialogStore.editBookmarkDialog.url = readMwcTextFieldValue(ev)
  }

  function onEditFolderTitleInput(ev: Event): void {
    options.dialogStore.editFolderDialog.title = readMwcTextFieldValue(ev)
  }

  function handleLeftTreeReady(): void {
    try {
      const hasData =
        Array.isArray(options.originalTree.value) && options.originalTree.value.length > 0
      if (options.isPageLoading.value && hasData) {
        options.isPageLoading.value = false
      }
    } catch (error) {
      logger.error('Management', '❌ handleLeftTreeReady 失败', error)
    }
  }

  function handleRightNodeEdit(node: BookmarkNode): void {
    if (node.url) {
      options.dialogStore.openEditBookmarkDialog(node)
    } else {
      options.dialogStore.openEditFolderDialog(node)
    }
  }

  function handleRightNodeDelete(node: BookmarkNode): void {
    const success = options.bookmarkManagementStore.deleteNodeFromProposal(node.id)
    if (!success) {
      logger.error('Management', 'Delete', '删除提案树节点失败', {
        nodeId: node.id
      })
    }
  }

  function toggleLeftPanel(): void {
    options.isLeftPanelCollapsed.value = !options.isLeftPanelCollapsed.value
  }

  function toggleLeftExpandAll(): void {
    if (isLeftExpanding.value) return
    isLeftExpanding.value = true
    try {
      options.setLeftTreeExpanded(!options.leftExpandCommandExpanded.value)
    } finally {
      isLeftExpanding.value = false
    }
  }

  function toggleRightExpandAll(): void {
    if (isRightExpanding.value) return
    isRightExpanding.value = true
    try {
      options.setRightTreeExpanded(!options.rightExpandCommandExpanded.value)
    } finally {
      isRightExpanding.value = false
    }
  }

  function onRightSelectionChange(ids: string[]): void {
    options.rightSelectedIds.value = Array.isArray(ids) ? ids.map(String) : []
  }

  function toggleRightSelectAll(checked: boolean): void {
    if (checked) {
      const allIds = options.rightTreeIndex.getAllNodeIds()
      options.rightTreeRef.value?.selectNodesByIds?.(allIds, { append: false })
      options.setRightTreeExpanded(true)
    } else {
      options.rightTreeRef.value?.selectNodesByIds?.([], { append: false })
    }
  }

  function handleBookmarkCopyUrl(node: BookmarkNode): void {
    if (node.url) {
      navigator.clipboard.writeText(node.url)
      message.success('URL copied!')
    }
  }

  function handleBookmarkOpenNewTab(node: BookmarkNode): void {
    if (!node.url) {
      message.warning(t('management_no_valid_url'))
      return
    }

    const hasInternalTag = node.traitTags?.includes('internal')
    const isInternalUrl = isInternalProtocolUrl(node.url)

    if (hasInternalTag || isInternalUrl) {
      message.warning(t('management_cannot_open_internal'))
      logger.warn('Management', '尝试打开内部协议书签:', node.url)
      return
    }

    try {
      if (typeof window === 'undefined') {
        logger.error('Management', '非浏览器环境，无法打开链接')
        message.error(t('management_open_link_failed'))
        return
      }

      const newWindow = window.open(node.url, '_blank')
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        message.warning(t('management_link_blocked'))
        logger.warn('Management', '链接被浏览器阻止:', node.url)
      }
    } catch (error) {
      message.error(t('management_open_link_failed'))
      logger.error('Management', '打开链接失败:', error, node.url)
    }
  }

  return {
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
  }
}
