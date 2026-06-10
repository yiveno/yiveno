import { computed, nextTick, ref } from 'vue'
import { message } from '@/application/message/message-service'
import { DataValidator } from '@/core/common/store-error'
import { logger } from '@/infrastructure/logging/logger'
import type { ProposalEditNodeData } from '@/application/bookmark/proposal-tree-edit-service'
import type { BookmarkNode } from '@/types'
import { t } from '@/utils/i18n-helpers'

interface DialogStoreLike {
  editBookmarkDialog: {
    bookmark: BookmarkNode | null
    title: string
    url: string
    parentId?: string | undefined
  }
  editFolderDialog: {
    folder: BookmarkNode | null
    title: string
  }
  closeEditBookmarkDialog(): void
  closeEditFolderDialog(): void
}

interface BookmarkManagementStoreLike {
  editNodeInProposal(data: ProposalEditNodeData): boolean
}

/**
 * 管理页书签/文件夹编辑对话框确认逻辑
 */
export function useManagementEditDialogs(options: {
  dialogStore: DialogStoreLike
  bookmarkManagementStore: BookmarkManagementStoreLike
}) {
  const { dialogStore, bookmarkManagementStore } = options

  const editFormErrors = ref<{ title: string; url: string }>({
    title: '',
    url: ''
  })
  const folderEditFormErrors = ref<{ title: string }>({ title: '' })
  const isEditingBookmark = ref(false)
  const isEditingFolder = ref(false)

  const MSG_CANCEL_EDIT = t('management_cancel_edit_message')

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
      const editData: ProposalEditNodeData = {
        id: dialogStore.editBookmarkDialog.bookmark!.id,
        title: dialogStore.editBookmarkDialog.title,
        url: dialogStore.editBookmarkDialog.url
      }
      if (dialogStore.editBookmarkDialog.parentId) {
        editData.parentId = dialogStore.editBookmarkDialog.parentId
      }
      const edited = bookmarkManagementStore.editNodeInProposal(editData)
      if (!edited) {
        throw new Error('编辑节点失败')
      }
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
      const edited = bookmarkManagementStore.editNodeInProposal({
        id: dialogStore.editFolderDialog.folder!.id,
        title: dialogStore.editFolderDialog.title,
        url: ''
      })
      if (!edited) {
        throw new Error('编辑节点失败')
      }
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

  return {
    editFormErrors,
    folderEditFormErrors,
    isEditingBookmark,
    isEditingFolder,
    isEditDirty,
    isEditFolderDirty,
    MSG_CANCEL_EDIT,
    confirmEditBookmark,
    confirmEditFolder
  }
}
