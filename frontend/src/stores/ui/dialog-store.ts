/**
 * 对话框状态 Store
 * 负责管理各种对话框的显示状态和数据
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'

export interface DialogState {
  show: boolean
  title: string
  content: string
  confirmText: string
  cancelText: string
  onConfirm?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}

export interface EditBookmarkDialogState {
  isOpen: boolean
  bookmark: BookmarkNode | null
  title: string
  url: string
  parentId?: string | undefined
}

export interface EditFolderDialogState {
  isOpen: boolean
  folder: BookmarkNode | null
  title: string
}

export interface AddItemDialogState {
  isOpen: boolean
  type: 'folder' | 'bookmark'
  parentFolder: BookmarkNode | null
  title: string
  url: string
}

/**
 * 🔴 Session Storage Keys:
 * - `dialog_edit_bookmark_draft`: 编辑书签对话框草稿
 * - `dialog_edit_folder_draft`: 编辑文件夹对话框草稿
 * - `dialog_add_item_draft`: 添加新项目对话框草稿
 */
const SESSION_KEYS = {
  EDIT_BOOKMARK_DRAFT: 'dialog_edit_bookmark_draft',
  EDIT_FOLDER_DRAFT: 'dialog_edit_folder_draft',
  ADD_ITEM_DRAFT: 'dialog_add_item_draft'
} as const

export const useDialogStore = defineStore('dialog', () => {
  // === 通用对话框状态 ===
  const dialogState = ref<DialogState>({
    show: false,
    title: '',
    content: '',
    confirmText: '确认',
    cancelText: '取消'
  })

  // === 编辑书签对话框 ===
  const editBookmarkDialog = ref<EditBookmarkDialogState>({
    isOpen: false,
    bookmark: null,
    title: '',
    url: '',
    parentId: undefined
  })

  // === 编辑文件夹对话框 ===
  const editFolderDialog = ref<EditFolderDialogState>({
    isOpen: false,
    folder: null,
    title: ''
  })

  // === 添加新项目对话框 ===
  const addItemDialog = ref<AddItemDialogState>({
    isOpen: false,
    type: 'bookmark',
    parentFolder: null,
    title: '',
    url: ''
  })

  // === Session Storage 辅助方法 ===
  /**
   * 从 Session Storage 加载对话框草稿
   *
   * ⚠️ 注意：只恢复表单数据，不恢复打开状态
   * 这样可以避免刷新后弹窗自动打开，但保留了用户的草稿数据
   */
  const loadDialogDrafts = async () => {
    try {
      const [editBookmarkDraft, editFolderDraft, addItemDraft] =
        await Promise.all([
          chromeStorage.getSession<Partial<EditBookmarkDialogState>>(
            SESSION_KEYS.EDIT_BOOKMARK_DRAFT
          ),
          chromeStorage.getSession<Partial<EditFolderDialogState>>(
            SESSION_KEYS.EDIT_FOLDER_DRAFT
          ),
          chromeStorage.getSession<Partial<AddItemDialogState>>(
            SESSION_KEYS.ADD_ITEM_DRAFT
          )
        ])

      // ✅ 只恢复表单数据，不恢复打开状态（避免刷新后弹窗自动打开）
      if (editBookmarkDraft) {
        // 明确不恢复 isOpen 状态，逐个属性赋值以避免只读问题
        if (editBookmarkDraft.bookmark !== undefined) {
          editBookmarkDialog.value.bookmark = editBookmarkDraft.bookmark
        }
        if (editBookmarkDraft.title !== undefined) {
          editBookmarkDialog.value.title = editBookmarkDraft.title
        }
        if (editBookmarkDraft.url !== undefined) {
          editBookmarkDialog.value.url = editBookmarkDraft.url
        }
        if (editBookmarkDraft.parentId !== undefined) {
          editBookmarkDialog.value.parentId = editBookmarkDraft.parentId
        }
        logger.debug('DialogStore', '恢复编辑书签草稿（不打开弹窗）')
      }

      if (editFolderDraft) {
        if (editFolderDraft.folder !== undefined) {
          editFolderDialog.value.folder = editFolderDraft.folder
        }
        if (editFolderDraft.title !== undefined) {
          editFolderDialog.value.title = editFolderDraft.title
        }
        logger.debug('DialogStore', '恢复编辑文件夹草稿（不打开弹窗）')
      }

      if (addItemDraft) {
        if (addItemDraft.type !== undefined) {
          addItemDialog.value.type = addItemDraft.type
        }
        if (addItemDraft.parentFolder !== undefined) {
          addItemDialog.value.parentFolder = addItemDraft.parentFolder
        }
        if (addItemDraft.title !== undefined) {
          addItemDialog.value.title = addItemDraft.title
        }
        if (addItemDraft.url !== undefined) {
          addItemDialog.value.url = addItemDraft.url
        }
        logger.debug('DialogStore', '恢复添加项目草稿（不打开弹窗）')
      }

      logger.debug('DialogStore', '✅ 对话框草稿已从 session storage 恢复')
    } catch (error) {
      logger.warn('DialogStore', '对话框草稿加载失败，使用默认值', error)
    }
  }

  /**
   * 保存编辑书签对话框草稿
   *
   * ⚠️ 只保存表单数据，不保存 isOpen 状态
   */
  const saveEditBookmarkDraft = async () => {
    try {
      if (!editBookmarkDialog.value.isOpen) {
        // 对话框关闭时清除草稿
        await chromeStorage.setSession(SESSION_KEYS.EDIT_BOOKMARK_DRAFT, null)
        return
      }

      // ✅ 只保存表单数据，不包含 isOpen
      const { isOpen, ...draftData } = editBookmarkDialog.value
      await chromeStorage.setSession(
        SESSION_KEYS.EDIT_BOOKMARK_DRAFT,
        draftData
      )
    } catch (error) {
      logger.warn('DialogStore', '保存编辑书签草稿失败', error)
    }
  }

  /**
   * 保存编辑文件夹对话框草稿
   *
   * ⚠️ 只保存表单数据，不保存 isOpen 状态
   */
  const saveEditFolderDraft = async () => {
    try {
      if (!editFolderDialog.value.isOpen) {
        await chromeStorage.setSession(SESSION_KEYS.EDIT_FOLDER_DRAFT, null)
        return
      }

      // ✅ 只保存表单数据，不包含 isOpen
      const { isOpen, ...draftData } = editFolderDialog.value
      await chromeStorage.setSession(SESSION_KEYS.EDIT_FOLDER_DRAFT, draftData)
    } catch (error) {
      logger.warn('DialogStore', '保存编辑文件夹草稿失败', error)
    }
  }

  /**
   * 保存添加新项目对话框草稿
   *
   * ⚠️ 只保存表单数据，不保存 isOpen 状态
   */
  const saveAddItemDraft = async () => {
    try {
      if (!addItemDialog.value.isOpen) {
        await chromeStorage.setSession(SESSION_KEYS.ADD_ITEM_DRAFT, null)
        return
      }

      // ✅ 只保存表单数据，不包含 isOpen
      const { isOpen, ...draftData } = addItemDialog.value
      await chromeStorage.setSession(SESSION_KEYS.ADD_ITEM_DRAFT, draftData)
    } catch (error) {
      logger.warn('DialogStore', '保存添加项目草稿失败', error)
    }
  }

  // 🔴 初始化：从 session storage 加载草稿
  loadDialogDrafts().catch(err => {
    logger.error('DialogStore', '初始化对话框草稿失败', err)
  })

  // === 通用对话框 Actions ===

  /**
   * 显示确认对话框
   */
  const showConfirmDialog = (options: {
    title: string
    content: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
  }) => {
    dialogState.value = {
      show: true,
      title: options.title,
      content: options.content,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel
    }

    logger.info('Dialog', '显示确认对话框', { title: options.title })
  }

  /**
   * 隐藏通用对话框
   */
  const hideDialog = () => {
    dialogState.value.show = false
    dialogState.value.onConfirm = undefined
    dialogState.value.onCancel = undefined
    logger.info('Dialog', '隐藏通用对话框')
  }

  /**
   * 确认对话框
   */
  const confirmDialog = () => {
    if (dialogState.value.onConfirm) {
      dialogState.value.onConfirm()
    }
    hideDialog()
  }

  /**
   * 取消对话框
   */
  const cancelDialog = () => {
    if (dialogState.value.onCancel) {
      dialogState.value.onCancel()
    }
    hideDialog()
  }

  // === 编辑书签对话框 Actions ===

  /**
   * 打开编辑书签对话框
   */
  const openEditBookmarkDialog = (bookmark: BookmarkNode) => {
    editBookmarkDialog.value = {
      isOpen: true,
      bookmark,
      title: bookmark.title,
      url: bookmark.url || '',
      parentId: bookmark.parentId
    }

    logger.info('Dialog', '打开编辑书签对话框', {
      id: bookmark.id,
      title: bookmark.title
    })

    // 🔴 保存草稿到 session storage
    saveEditBookmarkDraft().catch(err => {
      logger.warn('Dialog', '保存编辑书签草稿失败', err)
    })
  }

  /**
   * 关闭编辑书签对话框
   */
  const closeEditBookmarkDialog = () => {
    editBookmarkDialog.value = {
      isOpen: false,
      bookmark: null,
      title: '',
      url: '',
      parentId: undefined
    }

    logger.info('Dialog', '关闭编辑书签对话框')

    // 🔴 清除草稿
    saveEditBookmarkDraft().catch(err => {
      logger.warn('Dialog', '清除编辑书签草稿失败', err)
    })
  }

  /**
   * 更新编辑书签数据
   */
  const updateEditBookmarkData = (
    data: Partial<Pick<EditBookmarkDialogState, 'title' | 'url' | 'parentId'>>
  ) => {
    if (data.title !== undefined) editBookmarkDialog.value.title = data.title
    if (data.url !== undefined) editBookmarkDialog.value.url = data.url
    if (data.parentId !== undefined)
      editBookmarkDialog.value.parentId = data.parentId

    // 🔴 同步草稿到 session storage
    saveEditBookmarkDraft().catch(err => {
      logger.warn('Dialog', '更新编辑书签草稿失败', err)
    })
  }

  // === 编辑文件夹对话框 Actions ===

  /**
   * 打开编辑文件夹对话框
   */
  const openEditFolderDialog = (folder: BookmarkNode) => {
    editFolderDialog.value = {
      isOpen: true,
      folder,
      title: folder.title
    }

    logger.info('Dialog', '打开编辑文件夹对话框', {
      id: folder.id,
      title: folder.title
    })

    // 🔴 保存草稿到 session storage
    saveEditFolderDraft().catch(err => {
      logger.warn('Dialog', '保存编辑文件夹草稿失败', err)
    })
  }

  /**
   * 关闭编辑文件夹对话框
   */
  const closeEditFolderDialog = () => {
    editFolderDialog.value = {
      isOpen: false,
      folder: null,
      title: ''
    }

    logger.info('Dialog', '关闭编辑文件夹对话框')

    // 🔴 清除草稿
    saveEditFolderDraft().catch(err => {
      logger.warn('Dialog', '清除编辑文件夹草稿失败', err)
    })
  }

  /**
   * 更新编辑文件夹数据
   */
  const updateEditFolderData = (
    data: Partial<Pick<EditFolderDialogState, 'title'>>
  ) => {
    if (data.title !== undefined) editFolderDialog.value.title = data.title

    // 🔴 同步草稿到 session storage
    saveEditFolderDraft().catch(err => {
      logger.warn('Dialog', '更新编辑文件夹草稿失败', err)
    })
  }

  // === 添加新项目对话框 Actions ===

  /**
   * 打开添加新项目对话框
   */
  const openAddItemDialog = (
    type: 'folder' | 'bookmark',
    parentFolder?: BookmarkNode
  ) => {
    addItemDialog.value = {
      isOpen: true,
      type,
      parentFolder: parentFolder || null,
      title: '',
      url: ''
    }

    logger.info('Dialog', '打开添加新项目对话框', {
      type,
      parentId: parentFolder?.id
    })

    // 🔴 保存草稿到 session storage
    saveAddItemDraft().catch(err => {
      logger.warn('Dialog', '保存添加项目草稿失败', err)
    })
  }

  /**
   * 关闭添加新项目对话框
   */
  const closeAddItemDialog = () => {
    addItemDialog.value = {
      isOpen: false,
      type: 'bookmark',
      parentFolder: null,
      title: '',
      url: ''
    }

    logger.info('Dialog', '关闭添加新项目对话框')

    // 🔴 清除草稿
    saveAddItemDraft().catch(err => {
      logger.warn('Dialog', '清除添加项目草稿失败', err)
    })
  }

  /**
   * 更新添加新项目数据
   */
  const updateAddItemData = (
    data: Partial<
      Pick<AddItemDialogState, 'type' | 'title' | 'url' | 'parentFolder'>
    >
  ) => {
    if (data.type !== undefined) addItemDialog.value.type = data.type
    if (data.title !== undefined) addItemDialog.value.title = data.title
    if (data.url !== undefined) addItemDialog.value.url = data.url
    if (data.parentFolder !== undefined)
      addItemDialog.value.parentFolder = data.parentFolder

    // 🔴 同步草稿到 session storage
    saveAddItemDraft().catch(err => {
      logger.warn('Dialog', '更新添加项目草稿失败', err)
    })
  }

  // === 批量操作 Actions ===

  /**
   * 关闭所有对话框
   */
  const closeAllDialogs = () => {
    hideDialog()
    closeEditBookmarkDialog()
    closeEditFolderDialog()
    closeAddItemDialog()
    logger.info('Dialog', '关闭所有对话框')
    // Note: closeXxxDialog() 方法已经包含了清除 session storage 的逻辑
  }

  /**
   * 重置所有对话框状态
   */
  const resetAllDialogs = () => {
    dialogState.value = {
      show: false,
      title: '',
      content: '',
      confirmText: '确认',
      cancelText: '取消'
    }

    editBookmarkDialog.value = {
      isOpen: false,
      bookmark: null,
      title: '',
      url: '',
      parentId: undefined
    }

    editFolderDialog.value = {
      isOpen: false,
      folder: null,
      title: ''
    }

    addItemDialog.value = {
      isOpen: false,
      type: 'bookmark',
      parentFolder: null,
      title: '',
      url: ''
    }

    logger.info('Dialog', '重置所有对话框状态')

    // 🔴 清除所有草稿
    Promise.all([
      saveEditBookmarkDraft(),
      saveEditFolderDraft(),
      saveAddItemDraft()
    ]).catch(err => {
      logger.warn('Dialog', '清除所有草稿失败', err)
    })
  }

  return {
    // State
    dialogState,
    editBookmarkDialog,
    editFolderDialog,
    addItemDialog,

    // General Dialog Actions
    showConfirmDialog,
    hideDialog,
    confirmDialog,
    cancelDialog,

    // Edit Bookmark Dialog Actions
    openEditBookmarkDialog,
    closeEditBookmarkDialog,
    updateEditBookmarkData,

    // Edit Folder Dialog Actions
    openEditFolderDialog,
    closeEditFolderDialog,
    updateEditFolderData,

    // Add Item Dialog Actions
    openAddItemDialog,
    closeAddItemDialog,
    updateAddItemData,

    // Batch Actions
    closeAllDialogs,
    resetAllDialogs
  }
})
