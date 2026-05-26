<script setup lang="ts">
import { schedulerService } from '@/application/scheduler/scheduler-service'
import { useNotification } from '@/composables/useNotification'
import { useThemeSync } from '@/composables/useThemeSync'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'ManagementPage'
})

// 启用主题同步
useThemeSync('Management')
import { storeToRefs } from 'pinia'
// useManagementStore 已迁移到新的专业化 Store
import { useDialogStore, useBookmarkManagementStore, useTraitFilterStore } from '@/stores'
import type { TraitTag } from '@/types/domain/trait'
import {
  AppHeader,
  BookmarkSearchInput,
  Card,
  Dialog,
  LucideIcon,
  AnimatedNumber
} from '@/components'
import { Loading } from '@/components/base/Loading'
import { notificationService } from '@/application/notification/notification-service'
import { message } from '@/application/message/message-service'
import { NOTIFICATION_CONFIG } from '@/config/constants'
import { onEvent } from '@/infrastructure/events/event-bus'
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
// 导入书签 API 网关：以 side-effect 方式初始化并设置事件监听与消息桥接
import '@/infrastructure/chrome-api/bookmark-gateway'
import { DataValidator } from '@/core/common/store-error'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
// 数据健康检查已移除，使用特征检测代替
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import type {
  DiffResult,
  BookmarkOperation,
  BookmarkOperationType
} from '@/application/bookmark/bookmark-diff-service'
import type { AddItemData, EditBookmarkData } from '@/stores/bookmark/bookmark-management-store'
// AI 整理功能临时禁用，等待重构
// import { aiAppService } from '@/application/ai/ai-app-service'
// import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
// import { treeAppService } from '@/application/bookmark/tree-app-service'
// import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { enableEnvSnapshotBridge } from '@/devtools/env-snapshot'
import { enableEmbeddingDebugBridge } from '@/devtools/embedding-debug'
import { enableFolderVectorDebugBridge } from '@/devtools/folder-vector-debug'
import { createBookmarkIndex } from '@/application/bookmark/bookmark-index-app-service'

const dialogStore = useDialogStore()
const bookmarkManagementStore = useBookmarkManagementStore()
const traitFilterStore = useTraitFilterStore()

const { originalExpandedFolders, proposalExpandedFolders } = storeToRefs(bookmarkManagementStore)

// 应用更改相关状态
const showApplyConfirmDialog = ref(false)
const diffResult = ref<DiffResult | null>(null)
const applyStartTime = ref(0)

// AI 整理相关状态
const isOrganizing = ref(false)
const organizeProgress = ref({
  current: 0,
  total: 0,
  message: t('management_preparing_organize')
})
const showOrganizeProgress = ref(false)

let envSnapshotCleanup: (() => void) | null = null
let embeddingDebugCleanup: (() => void) | null = null
let folderVectorDebugCleanup: (() => void) | null = null
const shouldExposeEnvSnapshot =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || new URLSearchParams(window.location.search).get('abDevtools') === '1')

if (shouldExposeEnvSnapshot) {
  onMounted(() => {
    envSnapshotCleanup = enableEnvSnapshotBridge()
    embeddingDebugCleanup = enableEmbeddingDebugBridge()
    folderVectorDebugCleanup = enableFolderVectorDebugBridge()
  })
  onUnmounted(() => {
    envSnapshotCleanup?.()
    envSnapshotCleanup = null
    embeddingDebugCleanup?.()
    embeddingDebugCleanup = null
    folderVectorDebugCleanup?.()
    folderVectorDebugCleanup = null
  })
}

/**
 * 动态生成"应用"按钮的 tooltip 提示文字
 * 让用户明确了解按钮为何被禁用
 */
const applyButtonTooltip = computed(() => {
  // 1. 页面加载中
  if (isPageLoading.value) {
    return t('management_tooltip_page_loading')
  }

  // 2. 没有未保存的更改
  if (!bookmarkManagementStore.hasUnsavedChanges) {
    return t('management_tooltip_no_changes')
  }

  // 3. 正常可用状态
  return t('management_tooltip_apply_ready')
})

/**
 * 动态生成"清除选择"按钮的 tooltip
 */
const clearSelectionTooltip = computed(() => {
  if (rightSelectedIds.value.length === 0) {
    return t('management_tooltip_no_selection')
  }
  return t('management_tooltip_clear_selection')
})

/**
 * 动态生成"删除"按钮的 tooltip
 */
const deleteButtonTooltip = computed(() => {
  if (selectedCounts.value.bookmarks === 0 && selectedCounts.value.folders === 0) {
    return t('management_tooltip_no_selection')
  }
  const parts = []
  if (selectedCounts.value.bookmarks > 0) {
    parts.push(`${selectedCounts.value.bookmarks} ${t('management_bookmarks_count')}`)
  }
  if (selectedCounts.value.folders > 0) {
    parts.push(`${selectedCounts.value.folders} ${t('management_folders_count')}`)
  }
  return t('management_tooltip_delete_selected', parts.join('和'))
})

/**
 * ✅ 特征检测由 Background Script 自动维护，无需 loading 状态
 * @deprecated isCleanupLoading 已移除，特征检测在后台异步执行
 */

const isAddingItem = ref(false)
const isEditingBookmark = ref(false)
const isEditingFolder = ref(false)
const isDeletingFolder = ref(false)
const isBulkDeleting = ref(false)

const { originalTree, newProposalTree, isPageLoading, loadingMessage } =
  storeToRefs(bookmarkManagementStore)

const rightTreeSelectedDescCounts = ref(new Map<string, number>())

const rightTreeIndex = createBookmarkIndex()

const {
  getProposalPanelTitle,
  getProposalPanelIcon,
  initialize: initializeStore,
  deleteFolder,
  bulkDeleteByIds
  // setProposalTree - AI 整理功能临时禁用
} = bookmarkManagementStore

const leftSearchResults = ref<BookmarkNode[]>([])
const isLeftSearchActive = ref(false)

const rightSearchResults = ref<BookmarkNode[]>([])
const isRightSearchActive = ref(false)
const handleLeftSearch = async (results: BookmarkNode[]) => {
  leftSearchResults.value = results
  isLeftSearchActive.value = true

  if (results.length > 0) {
    await nextTick()
    leftTreeRef.value?.expandAll?.()
    leftExpandAll.value = true
  } else {
    leftTreeRef.value?.collapseAll?.()
    leftExpandAll.value = false
  }
}

const handleLeftSearchClear = () => {
  isLeftSearchActive.value = false
  leftSearchResults.value = []
  leftTreeRef.value?.collapseAll?.()
  leftExpandAll.value = false
}

const handleRightSearch = async (results: BookmarkNode[]) => {
  rightSearchResults.value = results
  isRightSearchActive.value = true

  if (results.length > 0) {
    await nextTick()
    rightTreeRef.value?.expandAll?.()
    rightExpandAll.value = true
  } else {
    rightTreeRef.value?.collapseAll?.()
    rightExpandAll.value = false
  }
}

const handleRightSearchClear = () => {
  isRightSearchActive.value = false
  rightSearchResults.value = []
  rightTreeRef.value?.collapseAll?.()
  rightExpandAll.value = false
}

const leftTreeData = computed(() =>
  isLeftSearchActive.value ? leftSearchResults.value : originalTree.value
)

const rightTreeData = computed(() =>
  isRightSearchActive.value ? rightSearchResults.value : newProposalTree.value.children || []
)

const MSG_CANCEL_EDIT = t('management_cancel_edit_message')
const MSG_CANCEL_ADD = t('management_cancel_add_message')
const addDialogTitle = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark'
    ? t('management_add_new_bookmark')
    : t('management_add_new_folder')
)
const addDialogIcon = computed(() =>
  dialogStore.addItemDialog.type === 'bookmark' ? 'icon-bookmark' : 'icon-folder'
)
const addConfirmText = computed(() => t('management_add'))

/** 添加对话框：当前父文件夹展示（无选中时视为「我的书签」根区） */
const addItemParentFolderLabel = computed(() => {
  const folder = dialogStore.addItemDialog.parentFolder
  const title = folder?.title?.trim()
  if (title) return title
  return t('management_my_bookmarks')
})

function readMwcTextFieldValue(ev: Event): string {
  const el = ev.target as unknown as { value?: string }
  return typeof el.value === 'string' ? el.value : ''
}

function onEditBookmarkTitleInput(ev: Event) {
  dialogStore.editBookmarkDialog.title = readMwcTextFieldValue(ev)
}

function onEditBookmarkUrlInput(ev: Event) {
  dialogStore.editBookmarkDialog.url = readMwcTextFieldValue(ev)
}

function onEditFolderTitleInput(ev: Event) {
  dialogStore.editFolderDialog.title = readMwcTextFieldValue(ev)
}

function onAddItemTitleInput(ev: Event) {
  dialogStore.addItemDialog.title = readMwcTextFieldValue(ev)
}

function onAddItemUrlInput(ev: Event) {
  dialogStore.addItemDialog.url = readMwcTextFieldValue(ev)
}

const addDialogContentRef = ref<HTMLElement | null>(null)
const addDialogMinHeight = ref<string>('')

watch(
  () => dialogStore.addItemDialog.isOpen,
  async open => {
    if (open) {
      await nextTick()
      requestAnimationFrame(() => {
        const el = addDialogContentRef.value
        if (el) {
          const h = el.offsetHeight
          if (h && h > 0) {
            addDialogMinHeight.value = `${h}px`
          }
        }
      })
    } else {
      addDialogMinHeight.value = ''
    }
  }
)

const pendingTagSelection = ref<TraitTag[] | null>(null)

const leftTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightTreeRef = ref<InstanceType<typeof BookmarkTree> | null>(null)
const rightSelectedIds = ref<string[]>([])

watch(
  () => rightTreeData.value,
  newData => {
    if (Array.isArray(newData) && newData.length > 0) {
      rightTreeIndex.buildFromTree(newData)
      logger.info('Management', `右侧树索引已更新: ${rightTreeIndex.getSize()} 个节点`)
    }
  },
  { immediate: true, deep: false }
)

// eslint-disable-next-line complexity -- 此函数需要处理多种书签节点类型和层级关系，复杂度较高但逻辑清晰
const selectedCounts = computed(() => {
  const bookmarkIds = new Set<string>()
  const selectedFolderIds = new Set<string>()

  for (const rawId of rightSelectedIds.value) {
    const id = String(rawId)
    const node = rightTreeIndex.getNode(id)
    if (!node) continue

    if (node.url) {
      // 这是一个书签
      bookmarkIds.add(id)
    } else {
      // 这是一个文件夹
      // ✅ 修复：排除顶层根节点（书签栏、其他书签等）
      // Chrome 书签结构：'0' 是根容器，'1' 是书签栏，'2' 是其他书签
      // 只统计用户可见的子文件夹，不包括这些顶层容器
      const isTopLevelRoot =
        !node.parentId || node.parentId === '0' || node.id === '1' || node.id === '2'

      if (!isTopLevelRoot) {
        selectedFolderIds.add(id)
      }

      // 遍历该文件夹的所有子节点
      const stack: string[] = [id]
      while (stack.length > 0) {
        const currentId = stack.pop()!
        const current = rightTreeIndex.getNode(currentId)

        if (!current) continue

        if (current.url) {
          // 子节点是书签
          bookmarkIds.add(currentId)
        } else {
          // 子节点是文件夹
          // ✅ 所有子文件夹都应该被计入 selectedFolderIds（除了顶层根节点）
          if (currentId !== id) {
            const isChildTopLevelRoot =
              !current.parentId ||
              current.parentId === '0' ||
              current.id === '1' ||
              current.id === '2'
            // eslint-disable-next-line max-depth -- 嵌套深度由书签树结构决定，无法简化
            if (!isChildTopLevelRoot) {
              selectedFolderIds.add(currentId)
            }
          }
          const childrenIds = rightTreeIndex.getChildrenIds(currentId)
          stack.push(...Array.from(childrenIds))
        }
      }
    }
  }

  return { bookmarks: bookmarkIds.size, folders: selectedFolderIds.size }
})

watch(
  () => bookmarkManagementStore.hasUnsavedChanges,
  hasChanges => {
    if (hasChanges) {
      // ✅ 使用常量中定义的徽章颜色
      notificationService.updateBadge('!', NOTIFICATION_CONFIG.BADGE_COLORS.warning)
    } else {
      notificationService.clearBadge()
    }
  },
  { immediate: true }
)

watch(
  () => bookmarkManagementStore.newProposalTree,
  async newTree => {
    if (!newTree || !pendingTagSelection.value?.length) return
    await nextTick()
    // 清除待选中标签（已经应用筛选）
    // eslint-disable-next-line require-atomic-updates -- 清除待选中标签是原子操作，不会有竞态条件
    pendingTagSelection.value = null

    // 使用 traitFilterStore 的 filterResultIds 获取筛选结果
    const ids = traitFilterStore.filterResultIds
    if (!ids.length || !rightTreeRef.value) return

    try {
      const instance = rightTreeRef.value
      if (!instance) return
      if (typeof instance.selectNodesByIds === 'function') {
        instance.selectNodesByIds(ids, { append: false })
      }
      const firstId = ids[0]
      if (firstId && typeof instance.focusNodeById === 'function') {
        await instance.focusNodeById(firstId, {
          scrollIntoViewCenter: true
        })
      }
    } catch (error) {
      logger.warn('Management', 'Focus', '自动选中健康问题节点失败', error)
    }
  },
  { deep: false }
)
const leftExpandAll = ref(false)
const rightExpandAll = ref(false)

watch(
  () => rightTreeData.value,
  () => {
    clearRightSelection()
  },
  { deep: true }
)

const isExpanding = ref(false)
const editFormErrors = ref<{ title: string; url: string }>({
  title: '',
  url: ''
})
const addFormErrors = ref<{ title: string; url: string }>({
  title: '',
  url: ''
})

// ✅ 性能优化：合并多个表单字段的 watch 为单个 watch
watch(
  () => [
    dialogStore.editBookmarkDialog.url,
    dialogStore.editBookmarkDialog.title,
    dialogStore.addItemDialog.url,
    dialogStore.addItemDialog.title
  ],
  ([editUrl, editTitle, addUrl, addTitle]) => {
    // 清除编辑对话框错误
    if (editFormErrors.value.url && (editUrl || '').trim()) {
      editFormErrors.value.url = ''
    }
    if (editFormErrors.value.title && (editTitle || '').trim()) {
      editFormErrors.value.title = ''
    }
    // 清除添加对话框错误
    if (addFormErrors.value.url && (addUrl || '').trim()) {
      addFormErrors.value.url = ''
    }
    if (addFormErrors.value.title && (addTitle || '').trim()) {
      addFormErrors.value.title = ''
    }
  }
)
watch(
  () => dialogStore.addItemDialog.type,
  () => {
    if (!dialogStore.addItemDialog.isOpen) return
    dialogStore.addItemDialog.title = ''
    dialogStore.addItemDialog.url = ''
    addFormErrors.value.title = ''
    addFormErrors.value.url = ''
  }
)

const handleLeftTreeReady = () => {
  try {
    const hasData = Array.isArray(originalTree.value) && originalTree.value.length > 0
    if (isPageLoading.value && hasData) {
      isPageLoading.value = false
    }
  } catch (error) {
    logger.error('Management', '❌ handleLeftTreeReady 失败', error)
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
const folderEditFormErrors = ref<{ title: string }>({ title: '' })
watch(
  () => dialogStore.editFolderDialog.title,
  val => {
    if (folderEditFormErrors.value.title && (val || '').trim()) {
      folderEditFormErrors.value.title = ''
    }
  }
)

const isConfirmDeleteDialogOpen = ref(false)
const deleteTargetFolder = ref<BookmarkNode | null>(null)
const deleteFolderBookmarkCount = ref(0)

/**
 * 右侧面板：编辑节点（仅内存操作）
 */
const handleRightNodeEdit = (node: BookmarkNode) => {
  if (node.url) {
    dialogStore.openEditBookmarkDialog(node)
  } else {
    dialogStore.openEditFolderDialog(node)
  }
}

/**
 * 右侧面板：删除节点（仅内存操作）
 */
const handleRightNodeDelete = (node: BookmarkNode) => {
  const success = bookmarkManagementStore.deleteNodeFromProposal(node.id)

  if (!success) {
    logger.error('Management', 'Delete', '删除提案树节点失败', { nodeId: node.id })
  }
}

/**
 * 右侧面板：添加书签/文件夹（仅内存操作）
 */
const handleRightFolderAdd = (node: BookmarkNode) => {
  dialogStore.openAddItemDialog('bookmark', node)
}

/**
 * 检查 URL 是否为浏览器内部协议
 */
const isInternalProtocolUrl = (url: string): boolean => {
  if (!url) return false
  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.startsWith('chrome://') ||
    lowerUrl.startsWith('chrome-extension://') ||
    lowerUrl.startsWith('about:') ||
    lowerUrl.startsWith('file://') ||
    lowerUrl.startsWith('edge://') ||
    lowerUrl.startsWith('brave://')
  )
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (!node.url) {
    message.warning(t('management_no_valid_url'))
    return
  }

  // 检查是否为内部协议书签（优先检查标签，兜底检查 URL）
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

    // 打开书签（不记录访问，因为这是管理操作，不是真实使用）
    const newWindow = window.open(node.url, '_blank')

    // 检查是否被浏览器阻止
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      message.warning(t('management_link_blocked'))
      logger.warn('Management', '链接被浏览器阻止:', node.url)
    }
  } catch (error) {
    message.error(t('management_open_link_failed'))
    logger.error('Management', '打开链接失败:', error, node.url)
  }
}

/**
 * 处理添加对话框的 Tab 切换
 * Material Web Tabs 的 change 事件会传递 CustomEvent，包含 activeTabIndex
 */
const handleAddDialogTabChange = (event: Event) => {
  const customEvent = event as CustomEvent<{ activeTabIndex: number }>
  const activeTabIndex = customEvent.detail?.activeTabIndex ?? 0

  // 根据 tab index 更新对话框类型
  dialogStore.addItemDialog.type = activeTabIndex === 0 ? 'bookmark' : 'folder'

  // 清空表单数据和错误
  dialogStore.addItemDialog.title = ''
  dialogStore.addItemDialog.url = ''
  addFormErrors.value.title = ''
  addFormErrors.value.url = ''
}

const confirmAddNewItem = async () => {
  const title = (dialogStore.addItemDialog.title || '').trim()
  if (!title) {
    addFormErrors.value.title = t('management_title_required')
    return
  }
  if (dialogStore.addItemDialog.type === 'bookmark') {
    const url = (dialogStore.addItemDialog.url || '').trim()
    if (!DataValidator.validateUrl(url)) {
      addFormErrors.value.url = t('management_url_invalid')
      return
    }
  }

  if (isAddingItem.value) return

  try {
    isAddingItem.value = true

    const itemType = dialogStore.addItemDialog.type === 'bookmark' ? '书签' : '文件夹'

    const addData: AddItemData = {
      type: dialogStore.addItemDialog.type,
      title: dialogStore.addItemDialog.title,
      url: dialogStore.addItemDialog.url
    }
    if (dialogStore.addItemDialog.parentFolder?.id) {
      addData.parentId = dialogStore.addItemDialog.parentFolder.id
    }

    const res = await bookmarkManagementStore.addBookmark(addData)

    dialogStore.closeAddItemDialog()

    if (res && rightTreeRef.value && typeof rightTreeRef.value.focusNodeById === 'function') {
      await nextTick()
      try {
        await rightTreeRef.value.focusNodeById(res.id, {
          collapseOthers: true,
          scrollIntoViewCenter: true
        })
      } catch (e) {
        logger.error('Management', 'Focus', '新增后定位失败', e)
      }
    }

    await nextTick()
    message.success(t('management_bookmark_added', itemType))
  } catch (error) {
    logger.error('Management', 'Add', '添加失败', error)
    message.error(t('management_add_failed'))
  } finally {
    // eslint-disable-next-line require-atomic-updates -- finally 块中的状态重置是安全的
    isAddingItem.value = false
  }
}

const confirmEditBookmark = async () => {
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

  try {
    isEditingBookmark.value = true

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
    // eslint-disable-next-line require-atomic-updates -- finally 块中的状态重置是安全的
    isEditingBookmark.value = false
  }
}

const confirmEditFolder = async () => {
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

  try {
    isEditingFolder.value = true

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
    // eslint-disable-next-line require-atomic-updates -- finally 块中的状态重置是安全的
    isEditingFolder.value = false
  }
}
const confirmDeleteFolder = async () => {
  if (deleteTargetFolder.value) {
    const folder = deleteTargetFolder.value

    if (isDeletingFolder.value) return

    try {
      isDeletingFolder.value = true

      try {
        await deleteFolder(folder.id)
      } catch (error) {
        logger.error('Management', '删除文件夹失败', error)
        message.error(t('management_delete_failed'))
      } finally {
        // eslint-disable-next-line require-atomic-updates -- finally 块中的状态重置是安全的
        isDeletingFolder.value = false
      }
    } catch (error) {
      logger.error('Management', '删除文件夹失败', error)
      message.error(t('management_delete_failed'))
      // eslint-disable-next-line require-atomic-updates -- 错误处理中的状态重置是安全的
      isDeletingFolder.value = false
    }
  }

  isConfirmDeleteDialogOpen.value = false
  // eslint-disable-next-line require-atomic-updates -- 清理状态是原子操作，不会有竞态条件
  deleteTargetFolder.value = null
  deleteFolderBookmarkCount.value = 0
}

const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  if (node.url) {
    navigator.clipboard.writeText(node.url)
    message.success('URL copied!')
  }
}
/**
 * 处理外部书签变更事件
 * 当检测到外部书签变更时（如 Chrome Sync、其他设备、书签管理器），
 * 如果用户没有未保存的修改，则静默刷新数据
 */
const handleExternalChange = async (data: {
  eventType: 'created' | 'changed' | 'moved' | 'removed'
  bookmarkId?: string
  timestamp: number
}) => {
  if (bookmarkManagementStore.isApplyingOwnChanges) {
    logger.debug('Management', '检测到自己触发的变更，忽略', data)
    return
  }

  logger.info('Management', '🔄 检测到外部书签变更', data)

  if (bookmarkManagementStore.hasUnsavedChanges) {
    logger.warn('Management', '用户有未保存的修改，暂不自动刷新')
    return
  }

  try {
    await initializeStore()
    logger.info('Management', '✅ 已静默刷新书签数据')
    message.info(t('management_external_change_detected'))
  } catch (error) {
    logger.error('Management', '静默刷新失败', error)
    message.error(t('management_refresh_failed'))
  }
}

const unsubscribeExternalChange = onEvent('data:synced', handleExternalChange)
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (bookmarkManagementStore.hasUnsavedChanges) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onUnmounted(() => {
  unsubscribeExternalChange()
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
})

onMounted(async () => {
  // ✅ 先初始化 store，等待数据加载完成
  await initializeStore()

  // 1. 从 session storage 读取初始筛选参数（优先级最高）
  let pendingTags: TraitTag[] = []
  try {
    const result = await chrome.storage.session.get('managementInitialFilter')
    if (result.managementInitialFilter) {
      const filter = result.managementInitialFilter as { tags?: string[]; timestamp?: number }
      const { tags, timestamp } = filter
      // 检查时间戳，避免使用过期的筛选状态（5秒内有效）
      if (tags && timestamp && Date.now() - timestamp < 5000) {
        pendingTags = tags.filter((tag: string): tag is TraitTag =>
          ['duplicate', 'invalid', 'internal'].includes(tag)
        )
        logger.info('Management', '从 session storage 读取筛选参数:', pendingTags)
        // 使用后立即清除，避免影响下次打开
        await chrome.storage.session.remove('managementInitialFilter')
      }
    }
  } catch (error) {
    logger.warn('Management', '读取 session storage 失败:', error)
  }

  // 2. 兜底：从 URL 参数读取（向后兼容）
  if (pendingTags.length === 0) {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const tagsParam = params.get('tags')
        if (tagsParam) {
          pendingTags = tagsParam
            .split(',')
            .map(tag => tag.trim())
            .filter((tag): tag is TraitTag => ['duplicate', 'invalid', 'internal'].includes(tag))
          logger.info('Management', '从 URL 参数读取筛选:', pendingTags)
        }
      }
    } catch (error) {
      logger.warn('Management', '解析 URL 参数失败:', error)
    }
  }

  // 3. 应用筛选（如果有待处理的筛选条件）
  // ✅ 特征数据由 Background Script 自动维护，无需手动触发检测
  if (pendingTags.length > 0) {
    logger.info('Management', '准备激活筛选:', pendingTags)

    // 等待下一帧，确保 UI 已更新
    await nextTick()

    // 设置筛选状态（会触发 BookmarkSearchInput 的 watch）
    traitFilterStore.setActiveFilters(pendingTags)
    logger.info('Management', '✅ traitFilterStore.setActiveFilters 已调用')

    // 设置待选中的节点（用于自动选中问题节点）
    pendingTagSelection.value = pendingTags
    logger.info('Management', '✅ pendingTagSelection 已设置')

    // 再等待一帧，确保筛选已应用
    await nextTick()
    logger.info(
      'Management',
      '✅ 筛选应该已经生效，当前 activeFilters:',
      traitFilterStore.activeFilters
    )
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)

    const g = window as unknown as Record<string, unknown>
    g.AB_setFolderExpanded = (id: string, expanded?: boolean) => {
      const comp = leftTreeRef.value
      if (!comp) return
      const sid = String(id)
      if (expanded === undefined) {
        if (typeof comp.toggleFolderById === 'function') comp.toggleFolderById(sid)
        return
      }
      if (expanded) {
        if (typeof comp.expandFolderById === 'function') comp.expandFolderById(sid)
      } else {
        if (typeof comp.collapseFolderById === 'function') comp.collapseFolderById(sid)
      }
    }
    g.AB_toggleFolder = (id: string) => {
      const comp = leftTreeRef.value
      if (!comp) return
      const sid = String(id)
      if (typeof comp.toggleFolderById === 'function') comp.toggleFolderById(sid)
    }
    g.AB_focusBookmark = (
      id: string,
      opts?: {
        collapseOthers?: boolean
        scrollIntoViewCenter?: boolean
        pathIds?: string[]
      }
    ) => {
      const comp = leftTreeRef.value
      if (!comp || !comp.focusNodeById) return
      comp.focusNodeById(String(id), opts || { collapseOthers: true, scrollIntoViewCenter: true })
    }
  }
})

const toggleLeftExpandAll = async () => {
  if (!leftTreeRef.value) return
  if (isExpanding.value) return
  isExpanding.value = true
  schedulerService.scheduleUIUpdate(() => {
    isPageLoading.value = true
    loadingMessage.value = leftExpandAll.value ? '正在收起...' : '正在展开...'
  })
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 0))
  if (leftExpandAll.value) {
    leftTreeRef.value.collapseAll()
    leftExpandAll.value = false
  } else {
    leftTreeRef.value.expandAll()
    leftExpandAll.value = true
  }
  schedulerService.scheduleUIUpdate(() => {
    isPageLoading.value = false
    isExpanding.value = false
  })
}

const toggleRightExpandAll = async () => {
  if (!rightTreeRef.value) return
  if (isExpanding.value) return
  isExpanding.value = true
  isPageLoading.value = true
  loadingMessage.value = rightExpandAll.value ? '正在收起...' : '正在展开...'
  // 让出两帧以确保蒙层先绘制（处理主线程阻塞导致的晚出现）
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 0))
  if (rightExpandAll.value) {
    rightTreeRef.value.collapseAll()
    rightExpandAll.value = false
  } else {
    rightTreeRef.value.expandAll()
    rightExpandAll.value = true
  }
  requestAnimationFrame(() => {
    isPageLoading.value = false
    isExpanding.value = false
  })
}

// 右侧选择变化：用于批量删除
const onRightSelectionChange = (ids: string[]) => {
  rightSelectedIds.value = Array.isArray(ids) ? ids.map(String) : []
}

// 清空选择：调用树组件 API，状态通过 selection-change 事件自动同步
const clearRightSelection = () => {
  try {
    rightTreeRef.value?.clearSelection?.()
  } catch {}
}

// 计算右侧树的全选状态
const rightSelectAllState = computed(() => {
  const totalNodes = getAllRightTreeNodeIds()
  const selectedCount = rightSelectedIds.value.length

  if (selectedCount === 0) {
    return { checked: false, indeterminate: false }
  }

  if (selectedCount === totalNodes.length) {
    return { checked: true, indeterminate: false }
  }

  return { checked: false, indeterminate: true }
})

// 统计右侧树数据中的实际书签和文件夹数量（用于调试和验证）
const rightTreeDataStats = computed(() => {
  let bookmarkCount = 0
  let folderCount = 0

  const countNodes = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      if (!node || !node.id) continue
      if (node.url) {
        bookmarkCount++
      } else {
        folderCount++
      }
      if (node.children && node.children.length) {
        countNodes(node.children)
      }
    }
  }

  countNodes(rightTreeData.value)
  return { bookmarkCount, folderCount, total: bookmarkCount + folderCount }
})

// 监控右侧树数据统计（用于调试数量不一致问题）
watch(
  () => rightTreeDataStats.value,
  stats => {
    logger.debug('Management', '右侧树数据统计', {
      bookmarks: stats.bookmarkCount,
      folders: stats.folderCount,
      total: stats.total
    })
  },
  { immediate: true }
)

/**
 * 获取右侧树所有节点 ID
 * 直接从索引获取，O(1) 操作
 *
 * @returns 所有节点 ID 数组
 */
const getAllRightTreeNodeIds = (): string[] => {
  return rightTreeIndex.getAllNodeIds()
}

// 全选/取消全选切换
const toggleRightSelectAll = (checked: boolean) => {
  if (checked) {
    // 全选
    const allIds = getAllRightTreeNodeIds()
    rightTreeRef.value?.selectNodesByIds?.(allIds, { append: false })
    // 全选后自动展开所有文件夹，方便用户确认选中内容
    nextTick(() => {
      rightTreeRef.value?.expandAll?.()
      rightExpandAll.value = true
    })
  } else {
    // 取消全选：显式传递空数组，确保所有节点（包括文件夹）都被取消选中
    rightTreeRef.value?.selectNodesByIds?.([], { append: false })
  }
}

// 使用 Notification 组件
const notification = useNotification()

const handleBookmarkMove = async (data: {
  sourceId: string
  targetId: string
  position: 'before' | 'inside' | 'after'
}) => {
  const callTime = Date.now()
  logger.info('Management', '🔵 拖拽移动书签开始', { ...data, callTime })

  try {
    const result = await bookmarkManagementStore.moveBookmark(data)

    if (result) {
      logger.info('Management', '📦 移动结果（可用于 Chrome API）', {
        nodeId: result.nodeId,
        newParentId: result.newParentId,
        newIndex: result.newIndex,
        chromeApiCall: `chrome.bookmarks.move('${result.nodeId}', { parentId: '${result.newParentId}', index: ${result.newIndex} })`
      })
    }

    notification.success({
      message: t('management_bookmark_moved'),
      key: 'bookmark-moved',
      duration: 2 // duration 单位为秒
    })
  } catch (error) {
    logger.error('Management', '移动书签失败', error)
    notification.error({
      message: t('management_move_failed'),
      description: t('management_move_failed_retry'),
      duration: 3 // duration 单位为秒
    })
  }
}

/**
 * 批量删除选中的书签和文件夹
 *
 * ✅ 直接执行删除，不需要确认对话框
 * 因为右侧面板的所有操作都需要点击"应用"才会真实生效
 * 应用时会有全面的确认提示
 */
const handleBulkDelete = async () => {
  const ids = rightSelectedIds.value.filter(Boolean)
  if (!ids.length) return

  if (isBulkDeleting.value) return // 防止重复点击

  try {
    isBulkDeleting.value = true

    bulkDeleteByIds(ids)

    // 清空选择，避免再次误删
    try {
      rightTreeRef.value?.clearSelection?.()
    } catch {}
  } catch (error) {
    logger.error('Management', '批量删除失败', error)
    message.error(t('management_bulk_delete_failed'))
  } finally {
    isBulkDeleting.value = false
  }
}

// ==================== 应用更改相关方法 ====================

/**
 * 确认对话框标题
 */
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

/**
 * 确认对话框图标
 */
const applyConfirmIcon = computed(() => {
  if (!diffResult.value) return 'icon-check'

  const total = diffResult.value.statistics.total
  if (total < 100) {
    return 'icon-check'
  } else {
    return 'icon-warning'
  }
})

/**
 * 预计剩余时间
 */
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
  } else {
    const minutes = Math.ceil(remaining / 60)
    return t('management_about_minutes', String(minutes))
  }
})

/**
 * 获取操作图标
 */
const getOperationIcon = (type: BookmarkOperationType): string => {
  const icons: Record<BookmarkOperationType, string> = {
    create: 'plus',
    move: 'refresh',
    edit: 'edit',
    delete: 'trash'
  }
  return icons[type] || 'bookmark'
}

/**
 * 获取操作类型文本
 */
const getOperationTypeText = (type: BookmarkOperationType): string => {
  const texts: Record<BookmarkOperationType, string> = {
    create: '新增',
    move: '移动',
    edit: '编辑',
    delete: '删除'
  }
  return texts[type] || type
}

/**
 * 按类型获取操作列表
 */
const getOperationsByType = (type: BookmarkOperationType): BookmarkOperation[] => {
  if (!diffResult.value) return []
  return diffResult.value.operations.filter(op => op.type === type)
}

/**
 * 一键整理书签栏（AI 自动分类）
 *
 * ⚠️ 临时禁用：organizeBookmarks 方法已从 aiAppService 中移除
 * TODO: 使用 folderVectorService 实现基于向量的本地推荐
 */
async function handleAIOrganize() {
  if (isOrganizing.value || isPageLoading.value) {
    return
  }

  try {
    isOrganizing.value = true

    // 临时提示：功能正在重构中
    message.info('AI 整理功能正在重构中，即将推出基于向量的本地推荐功能')

    /* 原实现已注释，等待使用 folderVectorService 重新实现
    showOrganizeProgress.value = true
    organizeProgress.value = {
      current: 0,
      total: 0,
      message: '正在加载书签...'
    }

    // 获取所有书签（只获取书签，不包括文件夹）
    const allBookmarksResult = await bookmarkAppService.getAllBookmarks()
    if (!allBookmarksResult.ok) {
      notificationService.notifyError('获取书签失败', 'AI 整理')
      return
    }

    const allBookmarks = allBookmarksResult.value
    // 过滤出书签（有 URL 的），排除文件夹和 Chrome 内部链接
    const bookmarkRecords = allBookmarks.filter(
      record => record.url && !record.url.startsWith('chrome://')
    )

    if (bookmarkRecords.length === 0) {
      message.info(t('management_no_bookmarks_to_organize'))
      return
    }

    organizeProgress.value = {
      current: 0,
      total: bookmarkRecords.length,
      message: t('management_organizing_bookmarks', String(bookmarkRecords.length))
    }

    // TODO: 使用 folderVectorService 实现分类推荐
    // const results = await folderVectorService.recommendFolders(bookmarkRecords)

    message.success(
      t('management_organize_success', [String(bookmarkRecords.length), String(0)])
    )
    */
  } catch (error) {
    logger.error('AI 整理失败', error)
    message.error(t('management_organize_failed'))
  } finally {
    isOrganizing.value = false
    showOrganizeProgress.value = false
  }
}

/**
 * 点击应用更改按钮
 */
const handleApplyClick = () => {
  // 检查是否有临时节点
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

    if (shouldContinue) {
      // 用户选择了解，继续显示差异（已过滤临时节点）
      const diff = bookmarkManagementStore.calculateDiff()

      if (!diff || diff.statistics.total === 0) {
        // 如果实际没有差异，重置标志位，禁用按钮
        bookmarkManagementStore.hasUnsavedChanges = false
        message.info(t('management_no_changes_detected'))
        return
      }

      diffResult.value = diff
      showApplyConfirmDialog.value = true
    }
    return
  }

  // 计算差异
  const diff = bookmarkManagementStore.calculateDiff()

  if (!diff || diff.statistics.total === 0) {
    // 如果实际没有差异，重置标志位，禁用按钮
    bookmarkManagementStore.hasUnsavedChanges = false
    message.info(t('management_no_changes_detected'))
    return
  }

  diffResult.value = diff
  showApplyConfirmDialog.value = true
}

/**
 * 获取临时节点信息
 * 直接从索引获取所有 ID 并过滤，避免递归遍历
 *
 * @param _nodes 节点数组（未使用，保留兼容性）
 * @returns 临时节点信息
 */
const getTempNodesInfo = (_nodes: BookmarkNode[]): { count: number; ids: string[] } => {
  const allIds = rightTreeIndex.getAllNodeIds()
  const tempIds = allIds.filter(id => id.startsWith('temp_'))

  return {
    count: tempIds.length,
    ids: tempIds
  }
}

/**
 * 确认应用更改
 */
const confirmApplyChanges = async () => {
  if (!diffResult.value) return

  try {
    // 关闭确认对话框
    showApplyConfirmDialog.value = false

    // 记录开始时间
    applyStartTime.value = Date.now()

    // 应用更改
    const result = await bookmarkManagementStore.applyChanges(
      diffResult.value.operations,
      (current, total, operation) => {
        // 进度回调（已在 store 中更新状态）
        logger.debug('Management', `应用进度: ${current}/${total}`, {
          operation
        })
      }
    )

    // 显示结果
    if (result.success) {
      message.success(t('management_all_changes_applied'))
    } else {
      message.warning(t('management_some_changes_failed', String(result.errors.length)))
      logger.error('Management', '应用更改部分失败', result.errors)
    }

    // 清空差异结果
    // eslint-disable-next-line require-atomic-updates -- 清空差异结果是原子操作，不会有竞态条件
    diffResult.value = null
  } catch (error) {
    logger.error('Management', '应用更改失败', error)
    message.error(t('management_apply_changes_failed'))
  }
}

/**
 * 顶部"应用"按钮点击事件
 */
const handleApply = () => {
  // 复用 handleApplyClick 的逻辑
  handleApplyClick()
}

// =============================
</script>

<template>
  <div class="management-page app-container">
    <div v-if="isPageLoading" class="page-overlay">
      <div class="overlay-loading">
        <Loading size="xl" :text="loadingMessage" />
      </div>
    </div>
    <GlobalSyncProgress />

    <GlobalQuickAddBookmark />

    <Dialog
      :show="showOrganizeProgress"
      :title="t('management_ai_organize_bookmarks')"
      persistent
      max-width="500px"
    >
      <div class="trait-scan-progress">
        <div class="progress-info">
          <div class="progress-message">{{ organizeProgress.message }}</div>
          <div class="progress-stats">
            {{ organizeProgress.current }} / {{ organizeProgress.total }}
          </div>
        </div>
        <md-linear-progress
          :value="
            organizeProgress.total > 0 ? organizeProgress.current / organizeProgress.total : 0
          "
        ></md-linear-progress>
      </div>
    </Dialog>
    <!-- 📝 应用更改确认对话框 -->
    <Dialog
      :show="showApplyConfirmDialog"
      :title="applyConfirmTitle"
      :icon="applyConfirmIcon"
      persistent
      :enter-to-confirm="true"
      max-width="600px"
      @update:show="showApplyConfirmDialog = $event"
      @confirm="confirmApplyChanges"
    >
      <div class="apply-confirm-dialog">
        <!-- AI 生成标记 -->
        <div v-if="bookmarkManagementStore.isAIGenerated" class="ai-badge">
          <LucideIcon name="sparkles" color="primary" />
          <span>{{ t('management_ai_generated_badge') }}</span>
        </div>

        <!-- 统计信息 -->
        <div class="statistics-section">
          <h3 class="section-title">{{ t('management_changes_overview') }}</h3>
          <div class="statistics-grid">
            <div class="stat-item">
              <span class="stat-label">{{ t('management_new_folders') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.newFolders || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_new_bookmarks') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.newBookmarks || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_moved') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.move || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_edited') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.edit || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('management_deleted') }}</span>
              <span class="stat-value error">{{ diffResult?.statistics.delete || 0 }}</span>
            </div>
            <div class="stat-item total">
              <span class="stat-label">{{ t('management_total') }}</span>
              <span class="stat-value">{{ diffResult?.statistics.total || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 详细列表（仅在操作数 < 100 时显示完整列表，100-500 显示汇总，>500 只显示统计） -->
        <div v-if="diffResult" class="details-section">
          <div v-if="diffResult.statistics.total < 100" class="detailed-list">
            <h3 class="section-title">{{ t('management_detailed_operations') }}</h3>
            <div class="operations-list">
              <div
                v-for="(op, index) in diffResult.operations.slice(0, 100)"
                :key="index"
                class="operation-item"
              >
                <LucideIcon :name="getOperationIcon(op.type)" />
                <span class="operation-type">{{ getOperationTypeText(op.type) }}</span>
                <span class="operation-title">{{ op.title }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="diffResult.statistics.total < 500" class="grouped-summary">
            <h3 class="section-title">{{ t('management_grouped_summary') }}</h3>
            <details v-if="diffResult.statistics.create > 0" class="summary-group" open>
              <summary>
                <LucideIcon name="plus" color="success" />
                <span>{{
                  t('management_create_nodes', String(diffResult.statistics.create))
                }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('create').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.isFolder ? '📁' : '📄' }} {{ op.title }}
                </div>
                <div v-if="getOperationsByType('create').length > 50" class="more-items">
                  {{
                    t('management_more_items', String(getOperationsByType('create').length - 50))
                  }}
                </div>
              </div>
            </details>
            <details v-if="diffResult.statistics.move > 0" class="summary-group">
              <summary>
                <LucideIcon name="refresh" color="primary" />
                <span>{{ t('management_move_nodes', String(diffResult.statistics.move)) }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('move').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div v-if="getOperationsByType('move').length > 50" class="more-items">
                  {{ t('management_more_items', String(getOperationsByType('move').length - 50)) }}
                </div>
              </div>
            </details>
            <details v-if="diffResult.statistics.edit > 0" class="summary-group">
              <summary>
                <LucideIcon name="edit" color="warning" />
                <span>{{ t('management_edit_nodes', String(diffResult.statistics.edit)) }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('edit').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div v-if="getOperationsByType('edit').length > 50" class="more-items">
                  {{ t('management_more_items', String(getOperationsByType('edit').length - 50)) }}
                </div>
              </div>
            </details>
            <details v-if="diffResult.statistics.delete > 0" class="summary-group">
              <summary>
                <LucideIcon name="trash" color="error" />
                <span>{{
                  t('management_delete_nodes', String(diffResult.statistics.delete))
                }}</span>
              </summary>
              <div class="group-items">
                <div
                  v-for="(op, index) in getOperationsByType('delete').slice(0, 50)"
                  :key="index"
                  class="group-item"
                >
                  {{ op.title }}
                </div>
                <div v-if="getOperationsByType('delete').length > 50" class="more-items">
                  {{
                    t('management_more_items', String(getOperationsByType('delete').length - 50))
                  }}
                </div>
              </div>
            </details>
          </div>
          <div v-else class="large-operation-warning">
            <LucideIcon name="alert-triangle" color="warning" :size="48" />
            <h3>{{ t('management_large_operation_warning') }}</h3>
            <p
              v-html="t('management_large_operation_desc', String(diffResult.statistics.total))"
            ></p>
            <p class="warning-text">{{ t('management_large_operation_warning_text') }}</p>
          </div>
        </div>
      </div>

      <template #actions>
        <md-text-button @click="showApplyConfirmDialog = false">
          {{ t('common_cancel') }}
        </md-text-button>
        <md-filled-button @click="confirmApplyChanges">
          {{ t('common_apply') }}
        </md-filled-button>
      </template>
    </Dialog>
    <!-- 📈 应用更改进度对话框 -->
    <Dialog
      :show="bookmarkManagementStore.applyProgress.isApplying"
      :title="t('management_applying_changes')"
      persistent
      :close-on-overlay="false"
      :esc-to-close="false"
      max-width="500px"
    >
      <div class="apply-progress">
        <div class="progress-info">
          <div class="progress-message">
            {{ bookmarkManagementStore.applyProgress.currentOperation }}
          </div>
          <div class="progress-stats">
            {{ bookmarkManagementStore.applyProgress.currentIndex }} /
            {{ bookmarkManagementStore.applyProgress.totalOperations }}
          </div>
        </div>
        <md-linear-progress
          :value="bookmarkManagementStore.applyProgress.percentage / 100"
        ></md-linear-progress>
        <div class="progress-tip">
          {{ t('management_estimated_time', estimatedRemainingTime) }}
        </div>
      </div>
    </Dialog>
    <AppHeader :show-side-panel-toggle="false" />
    <main class="main-content">
      <div class="management-container">
        <div class="management-row">
          <!-- Left Panel -->
          <div class="panel-col left-panel">
            <Card class="panel-card" elevation="medium">
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <LucideIcon name="folder" color="primary" />
                    <span class="panel-title">{{ t('management_my_bookmarks') }}</span>
                  </div>
                  <div class="panel-title-section">
                    <BookmarkSearchInput
                      mode="memory"
                      :data="originalTree"
                      :debounce="300"
                      @search-complete="handleLeftSearch"
                      @search-clear="handleLeftSearchClear"
                    />

                    <md-icon-button
                      :title="
                        leftExpandAll ? t('management_collapse_all') : t('management_expand_all')
                      "
                      :disabled="isPageLoading"
                      @click="toggleLeftExpandAll"
                    >
                      <span
                        class="expand-toggle-icon"
                        :class="{
                          expanded: leftExpandAll,
                          expanding: isPageLoading
                        }"
                      >
                        <LucideIcon :name="leftExpandAll ? 'chevrons-up' : 'chevrons-down'" />
                      </span>
                    </md-icon-button>
                  </div>
                </div>
              </template>

              <div class="panel-content">
                <BookmarkTree
                  ref="leftTreeRef"
                  :nodes="leftTreeData"
                  source="management"
                  height="100%"
                  size="spacious"
                  :loading="isPageLoading"
                  :editable="false"
                  :show-toolbar="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(originalExpandedFolders)"
                  :virtual="true"
                  :selectable="false"
                  :show-favorite-button="false"
                  :show-edit-button="false"
                  :show-delete-button="false"
                  :show-add-button="false"
                  :show-open-new-tab-button="false"
                  :show-copy-url-button="false"
                  :show-share-button="false"
                  :show-more-button="false"
                  @ready="handleLeftTreeReady"
                />
              </div>
            </Card>
          </div>

          <!-- Middle Divider -->
          <div class="panel-col divider-col">
            <div class="panel-divider">
              <LucideIcon name="chevrons-right" :size="24" color="muted" />
            </div>
          </div>

          <!-- Right Panel -->
          <div class="panel-col right-panel">
            <Card
              class="panel-card right-panel-card"
              elevation="medium"
              :footer-visible="true"
              footer-transition="card-footer-slide"
            >
              <template #header>
                <div class="panel-header">
                  <div class="panel-title-section">
                    <LucideIcon :name="getProposalPanelIcon()" />
                    <span class="panel-title">{{ getProposalPanelTitle() }}</span>
                  </div>
                  <div class="panel-title-section">
                    <div class="panel-actions">
                      <!-- ✅ 使用包装元素解决禁用状态下 tooltip 不显示的问题 -->
                      <span class="btn-wrapper" :title="applyButtonTooltip">
                        <md-filled-button
                          :disabled="isPageLoading || !bookmarkManagementStore.hasUnsavedChanges"
                          @click="handleApply"
                        >
                          <LucideIcon slot="icon" name="check-circle" />
                          {{ t('management_apply') }}
                        </md-filled-button>
                      </span>
                      <div class="panel-actions-divider"></div>
                      <md-filled-button
                        :disabled="isPageLoading || isOrganizing"
                        @click="handleAIOrganize"
                      >
                        <LucideIcon slot="icon" name="sparkles" :spin="isOrganizing" />
                        {{
                          isOrganizing ? t('management_organizing') : t('management_ai_organize')
                        }}
                      </md-filled-button>
                      <div class="panel-actions-divider"></div>
                      <BookmarkSearchInput
                        mode="memory"
                        :data="newProposalTree.children"
                        :debounce="300"
                        :enable-trait-filters="true"
                        :sync-with-store="true"
                        @search-complete="handleRightSearch"
                        @search-clear="handleRightSearchClear"
                      />
                      <md-icon-button
                        :title="
                          rightExpandAll ? t('management_collapse_all') : t('management_expand_all')
                        "
                        :disabled="isPageLoading"
                        @click="toggleRightExpandAll"
                      >
                        <span
                          class="expand-toggle-icon"
                          :class="{
                            expanded: rightExpandAll
                          }"
                        >
                          <LucideIcon :name="rightExpandAll ? 'chevrons-up' : 'chevrons-down'" />
                        </span>
                      </md-icon-button>
                    </div>
                  </div>
                </div>
              </template>

              <div class="panel-content">
                <!-- 特征筛选面板已移至 BookmarkSearchInput 组件 -->
                <BookmarkTree
                  ref="rightTreeRef"
                  :nodes="rightTreeData"
                  :selected-desc-counts="rightTreeSelectedDescCounts"
                  height="100%"
                  size="spacious"
                  :editable="true"
                  :show-toolbar="true"
                  :draggable="true"
                  selectable="multiple"
                  :show-selection-checkbox="true"
                  :toolbar-expand-collapse="false"
                  :highlight-matches="false"
                  :initial-expanded="Array.from(proposalExpandedFolders)"
                  :virtual="true"
                  :show-favorite-button="false"
                  :show-edit-button="true"
                  :show-delete-button="true"
                  :show-add-button="true"
                  :show-open-new-tab-button="true"
                  :show-copy-url-button="true"
                  @desc-counts-updated="rightTreeSelectedDescCounts = $event"
                  @request-clear-filters="traitFilterStore.clearFilters()"
                  @node-edit="handleRightNodeEdit"
                  @node-delete="handleRightNodeDelete"
                  @folder-add="handleRightFolderAdd"
                  @selection-change="onRightSelectionChange"
                  @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                  @bookmark-copy-url="handleBookmarkCopyUrl"
                  @bookmark-move="handleBookmarkMove"
                />
              </div>
              <template #footer>
                <!-- 右侧面板内底部批量操作条（始终显示） -->
                <div class="bulk-delete-in-panel">
                  <div class="selection-summary">
                    <md-checkbox
                      :checked="rightSelectAllState.checked"
                      :indeterminate="rightSelectAllState.indeterminate"
                      class="select-all-checkbox"
                      @change="toggleRightSelectAll"
                    ></md-checkbox>
                    <!-- ✅ 全选时文案变化 -->
                    <span class="text">{{
                      rightSelectAllState.checked && !rightSelectAllState.indeterminate
                        ? t('management_all_selected')
                        : t('management_selected')
                    }}</span>
                    <span class="count"><AnimatedNumber :value="selectedCounts.bookmarks" /></span>
                    <span class="text">{{ t('management_bookmarks_count') }}</span>
                    <span class="gap"></span>
                    <span class="count"><AnimatedNumber :value="selectedCounts.folders" /></span>
                    <span class="text">{{ t('management_folders_count') }}</span>
                  </div>
                  <div class="bulk-actions">
                    <!-- ✅ 清除选择按钮包装器 -->
                    <span class="btn-wrapper" :title="clearSelectionTooltip">
                      <Button
                        variant="text"
                        class="clear-selection"
                        :disabled="rightSelectedIds.length === 0"
                        @click="clearRightSelection"
                      >
                        {{ t('management_clear_selection', String(rightSelectedIds.length)) }}
                      </Button>
                    </span>
                    <!-- ✅ 删除按钮包装器 -->
                    <span class="btn-wrapper" :title="deleteButtonTooltip">
                      <md-filled-button
                        class="bulk-delete-btn error-button"
                        :disabled="selectedCounts.bookmarks === 0 && selectedCounts.folders === 0"
                        @click="handleBulkDelete"
                      >
                        <LucideIcon slot="icon" name="trash" />
                        {{ t('common_delete') }}
                      </md-filled-button>
                    </span>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </div>
    </main>
    <!-- Edit Bookmark Dialog -->
    <Dialog
      :show="dialogStore.editBookmarkDialog.isOpen"
      :title="t('management_edit_bookmark')"
      icon="icon-edit-bookmark"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :enable-cancel-guard="true"
      :cancel-confirm-text="MSG_CANCEL_EDIT"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openEditBookmarkDialog(dialogStore.editBookmarkDialog.bookmark!)
            : dialogStore.closeEditBookmarkDialog()
      "
      @confirm="confirmEditBookmark"
    >
      <div class="edit-form">
        <md-outlined-text-field
          class="form-field"
          :label="t('management_bookmark_title')"
          :value="dialogStore.editBookmarkDialog.title"
          :error="!!editFormErrors.title"
          :error-text="editFormErrors.title"
          @input="onEditBookmarkTitleInput"
        />
        <md-outlined-text-field
          class="form-field"
          :label="t('management_bookmark_url')"
          type="url"
          :value="dialogStore.editBookmarkDialog.url"
          :error="!!editFormErrors.url"
          :error-text="editFormErrors.url"
          @input="onEditBookmarkUrlInput"
        />
      </div>
      <template #actions>
        <md-text-button @click="dialogStore.closeEditBookmarkDialog()">
          {{ t('common_cancel') }}
        </md-text-button>
        <md-filled-button
          :disabled="!isEditDirty"
          :loading="isEditingBookmark"
          @click="confirmEditBookmark"
        >
          {{ t('management_update') }}
        </md-filled-button>
      </template>
    </Dialog>

    <!-- Edit Folder Dialog -->
    <Dialog
      :show="dialogStore.editFolderDialog.isOpen"
      :title="t('management_edit_folder')"
      icon="icon-folder-edit"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :enable-cancel-guard="true"
      :cancel-confirm-text="MSG_CANCEL_EDIT"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) =>
          v
            ? dialogStore.openEditFolderDialog(dialogStore.editFolderDialog.folder!)
            : dialogStore.closeEditFolderDialog()
      "
      @confirm="confirmEditFolder"
    >
      <div class="edit-form">
        <md-outlined-text-field
          class="form-field"
          :label="t('management_folder_title')"
          :value="dialogStore.editFolderDialog.title"
          :error="!!folderEditFormErrors.title"
          :error-text="folderEditFormErrors.title"
          @input="onEditFolderTitleInput"
        />
      </div>
      <template #actions>
        <md-text-button @click="dialogStore.closeEditFolderDialog()">
          {{ t('common_cancel') }}
        </md-text-button>
        <md-filled-button
          :disabled="!isEditFolderDirty"
          :loading="isEditingFolder"
          @click="confirmEditFolder"
        >
          {{ t('management_update') }}
        </md-filled-button>
      </template>
    </Dialog>

    <!-- Delete Folder Confirm Dialog -->
    <Dialog
      :show="isConfirmDeleteDialogOpen"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :title="t('management_confirm_delete')"
      icon="icon-delete"
      :persistent="true"
      max-width="480px"
      min-width="480px"
      @update:show="(v: boolean) => (isConfirmDeleteDialogOpen = v)"
      @confirm="confirmDeleteFolder"
    >
      <div class="confirm-content">
        {{ t('management_delete_folder_confirm', String(deleteFolderBookmarkCount)) }}
      </div>
      <template #actions>
        <md-text-button @click="isConfirmDeleteDialogOpen = false">
          {{ t('common_cancel') }}
        </md-text-button>
        <md-filled-tonal-button
          class="error-button"
          :loading="isDeletingFolder"
          @click="confirmDeleteFolder"
        >
          {{ t('management_confirm_delete') }}
        </md-filled-tonal-button>
      </template>
    </Dialog>

    <!-- Add New Item Dialog -->
    <Dialog
      :show="dialogStore.addItemDialog.isOpen"
      :title="addDialogTitle"
      :icon="addDialogIcon"
      :persistent="true"
      :esc-to-close="true"
      :enter-to-confirm="true"
      :enable-cancel-guard="true"
      :cancel-confirm-text="MSG_CANCEL_ADD"
      :body-min-height="addDialogMinHeight"
      max-width="500px"
      min-width="500px"
      @update:show="
        (v: boolean) => {
          if (v) {
            const parentFolder = dialogStore.addItemDialog.parentFolder
            dialogStore.openAddItemDialog(dialogStore.addItemDialog.type, parentFolder || undefined)
          } else {
            dialogStore.closeAddItemDialog()
          }
        }
      "
      @confirm="confirmAddNewItem"
    >
      <div ref="addDialogContentRef" class="add-item-form">
        <md-outlined-text-field
          class="form-field"
          :label="t('form_parent_folder')"
          :value="addItemParentFolderLabel"
          readonly
        />
        <!-- ✅ Material Web Tabs -->
        <md-tabs
          :active-tab-index="dialogStore.addItemDialog.type === 'bookmark' ? 0 : 1"
          @change="handleAddDialogTabChange"
        >
          <md-primary-tab>{{ t('management_bookmark') }}</md-primary-tab>
          <md-primary-tab>{{ t('management_folder') }}</md-primary-tab>
        </md-tabs>

        <!-- 书签表单 -->
        <div v-if="dialogStore.addItemDialog.type === 'bookmark'" class="form-fields">
          <md-outlined-text-field
            class="form-field"
            :label="t('management_title')"
            :value="dialogStore.addItemDialog.title"
            :error="!!addFormErrors.title"
            :error-text="addFormErrors.title"
            @input="onAddItemTitleInput"
          />
          <md-outlined-text-field
            class="form-field"
            :label="t('management_url')"
            type="url"
            :value="dialogStore.addItemDialog.url"
            :error="!!addFormErrors.url"
            :error-text="addFormErrors.url"
            @input="onAddItemUrlInput"
          />
        </div>
        <!-- 文件夹表单 -->
        <div v-else class="form-fields">
          <md-outlined-text-field
            class="form-field"
            :label="t('management_folder_name')"
            :value="dialogStore.addItemDialog.title"
            :error="!!addFormErrors.title"
            :error-text="addFormErrors.title"
            @input="onAddItemTitleInput"
          />
        </div>
      </div>
      <template #actions>
        <md-text-button @click="dialogStore.closeAddItemDialog()">
          {{ t('common_cancel') }}
        </md-text-button>
        <md-filled-button :loading="isAddingItem" @click="confirmAddNewItem">
          {{ addConfirmText }}
        </md-filled-button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* ========================================
 * Material Web Tabs 样式配置
 * ======================================== */
md-tabs {
  width: 100%;
  margin-bottom: var(--spacing-4);
}

/* 特征扫描进度对话框样式 */
.trait-scan-progress {
  padding: var(--spacing-4);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.progress-message {
  font-size: var(--font-size-body-medium);
  color: var(--color-text-primary);
}

.progress-stats {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

/* 应用更改对话框样式 */
.apply-confirm-dialog {
  max-height: 60vh;
  padding: var(--spacing-4);
  overflow-y: auto;
}

.ai-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-body-medium);
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-surface);
}

.statistics-section {
  margin-bottom: var(--spacing-4);
}

.section-title {
  margin-bottom: var(--spacing-3);
  font-size: var(--font-size-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
}

.statistics-grid {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(3, 1fr);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.stat-item.total {
  background: var(--color-primary-surface-strong);
}

.stat-label {
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: var(--font-size-heading-small);
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-value.error {
  color: var(--color-error);
}

.details-section {
  margin-top: var(--spacing-4);
}

.operations-list {
  max-height: 300px;
  padding: var(--spacing-2);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
  overflow-y: auto;
}

.operation-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border-bottom: 1px solid var(--color-outline-variant);
}

.operation-item:last-child {
  border-bottom: none;
}

.operation-type {
  min-width: 48px;
  font-size: var(--font-size-body-small);
  font-weight: 500;
}

.operation-title {
  flex: 1;
  font-size: var(--font-size-body-small);
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.grouped-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.summary-group {
  padding: var(--spacing-3);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-md);
}

.summary-group summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-body-medium);
  font-weight: 500;
  cursor: pointer;
  list-style: none;
}

.summary-group summary::-webkit-details-marker {
  display: none;
}

.group-items {
  max-height: 200px;
  margin-top: var(--spacing-3);
  padding-left: var(--spacing-6);
  overflow-y: auto;
}

.group-item {
  padding: var(--spacing-1) 0;
  font-size: var(--font-size-body-small);
  color: var(--color-text-secondary);
}

.more-items {
  padding: var(--spacing-2) 0;
  font-size: var(--font-size-body-small);
  font-style: italic;
  color: var(--color-text-tertiary);
}

.large-operation-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  text-align: center;
}

.large-operation-warning h3 {
  font-size: var(--font-size-heading-medium);
  font-weight: 600;
  color: var(--color-warning);
}

.large-operation-warning p {
  margin: 0;
  font-size: var(--font-size-body-medium);
  color: var(--color-text-secondary);
}

/* 警告文本 - 高特异性覆盖父元素样式 */
.large-operation-warning .warning-text,
p.warning-text {
  font-weight: 500;
  color: var(--color-warning);
}

.apply-progress {
  padding: var(--spacing-4);
}

.progress-tip {
  margin-top: var(--spacing-3);
  font-size: var(--font-size-body-small);
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
<style scoped>
.ai-status-right {
  margin-left: var(--spacing-3);
}
</style>
<style scoped>
.mt-sm {
  margin-top: var(--spacing-2);
}

.expand-toggle-icon {
  display: inline-flex;
  transition:
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.expand-toggle-icon.expanded {
  transform: rotate(180deg);
}

.expand-toggle-icon.expanding {
  opacity: 0.85;
}
</style>

<style scoped>
.bulk-delete-in-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-surface);
}

/* 选择统计：避免数字变化导致文本整体"抖动" */
.selection-summary {
  display: inline-flex;
  align-items: center; /* 让 Checkbox 与文字垂直居中对齐 */
  gap: var(--spacing-2);

  /* 消除模板空白带来的字符间距 */
  font-size: 0;
  font-weight: 600;

  /* ✅ 强化：防止点击时文本被选中（多浏览器兼容） */
  user-select: none;
}

.select-all-checkbox {
  /* ✅ 确保点击事件不穿透到文本 */
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  margin: calc(var(--spacing-2) * -1);

  /* ✅ 增加点击区域，减少误触文本 */
  padding: var(--spacing-2);
}

.selection-summary .text {
  font-size: 1rem; /* 恢复正常字号 */
}

.selection-summary .count {
  display: inline-block;

  /* 至少两位宽度（按字符单位），右对齐以保持文案稳定 */
  min-width: 3ch;

  /* 移除外边距，由显式 gap 控制空隙 */
  margin: 0;
  font-size: 1rem; /* 恢复正常字号 */
  font-weight: 800;
  text-align: center;

  /* 使用等宽数字和固定宽度避免横向位移 */
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

.selection-summary .gap {
  display: inline-block;
  width: var(--spacing-2-5);
  height: 1em;
}

.bulk-delete-btn {
  border: 1px solid var(--color-error);
  color: var(--color-text-on-primary);
  background: var(--color-error);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.clear-selection {
  color: var(--color-text-secondary);
}

.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}

/* 使用 Overlay 组件自身的全屏蒙版，已通过 props 统一透明度与模糊 */

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-6);
}

.loading-text {
  font-size: 1.2rem;
  font-weight: 500;
}

.loading-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.main-content {
  flex: none;
  height: calc(100vh - var(--spacing-16));
  padding: var(--spacing-lg);
  overflow: hidden;
}

.management-container {
  height: 100%;
}

.panel-col {
  display: flex;
  flex-direction: column;
  height: 100%;

  /* 允许子项在 Flex 布局中收缩，从而使内部产生滚动 */
  min-height: 0;
}

.panel-card {
  display: flex;
  flex-direction: column;
  flex: 1;

  /* 允许内容区域计算高度并滚动 */
  min-height: 0;
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
  overflow: hidden;
}

/* 左右面板等宽（列宽由 .management-row 的 grid 控制） */
.panel-col:first-child .panel-card {
  flex: 1;
  background: var(--color-bg-primary);
}

/* 右侧卡片：弱化背景，突出内容 */
.right-panel-card {
  flex: 1;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.panel-header {
  position: relative; /* 作为浮层定位参照 */
  display: flex;
  flex-wrap: nowrap; /* 防止按钮换行 */
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  width: 100%;
  overflow: visible; /* 放行浮层 */
}

.panel-title-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* 标题区域：可以灵活缩小 */
.panel-title-section:first-child {
  flex: 1 1 auto;
  min-width: 0; /* 允许文字缩略 */
}

/* 按钮区域：保持固定宽度 */
.panel-title-section:last-child {
  flex: 0 0 auto;
}

.panel-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--spacing-2);
}

.panel-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-stats {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.stats-separator {
  margin: 0 var(--spacing-1);
}

.stats-change {
  margin-left: var(--spacing-sm);
  font-weight: 500;
}

.stats-increase {
  color: var(--color-success);
}

.stats-decrease {
  color: var(--color-error);
}

.panel-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* 允许内部子元素计算高度，避免超出无法滚动 */

  /* 使左右面板内容可滚动（包含 legend 和树） */
  overflow-y: auto;
}

/* 中间分隔区样式 */
.divider-col {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
}

.panel-divider {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  opacity: 0.3;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.panel-divider:hover {
  opacity: 0.6;
}

/* 右侧面板操作区的分隔符 */
.panel-actions-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  opacity: 0.5;
}

/* ✅ 按钮包装器：用于在禁用状态下显示 tooltip */
.btn-wrapper {
  display: inline-flex;

  /* 确保 wrapper 不影响布局 */
  line-height: 0;
}

/* 优化"应用"按钮样式 */
.panel-actions .btn:first-child {
  padding-right: var(--spacing-3);
  padding-left: var(--spacing-3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  height: 100%;
  color: var(--color-text-secondary);
}

.edit-form md-outlined-text-field,
.add-item-form md-outlined-text-field {
  width: 100%;
}

.edit-form,
.add-item-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.form-fields {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  overflow: hidden;
}

/* 语义搜索样式 */
.semantic-search-panel {
  padding: var(--spacing-sm) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.semantic-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.semantic-input {
  flex: 1;
  min-width: 160px;
}

.semantic-topk {
  width: 120px;
}

.semantic-minsim {
  width: 140px;
}

.semantic-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-1-5) 0;
}

.semantic-loading-text {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-results {
  display: grid;
  gap: var(--spacing-1-5);
  grid-template-columns: 1fr;
  padding: var(--spacing-sm) 0;
}

.semantic-item {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.semantic-item:hover {
  background: var(--color-surface-hover);
}

.semantic-title {
  font-weight: 500;
}

.semantic-url {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.semantic-score {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* 局部：底部批量操作条入场/出场动画（出现：自下而上；消失：向下） */
.card-footer-slide-enter-active,
.card-footer-slide-leave-active {
  transition:
    transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
  will-change: transform, opacity;
}

.card-footer-slide-enter-from {
  opacity: 0;
  transform: translateY(var(--spacing-4));
}

.card-footer-slide-leave-to {
  opacity: 0;
  transform: translateY(var(--spacing-4));
}

.control-btn--icon {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
}

.control-btn--icon .btn__icon {
  margin: 0;
}
</style>

<!-- 无 scoped：Material 根节点 token + 管理页主栅格（此前误写在 style 外导致未生效） -->
<style>
md-linear-progress {
  --md-linear-progress-track-height: 8px;

  width: 100%;
}

md-text-button,
md-filled-button,
md-filled-tonal-button,
md-icon-button {
  --md-sys-color-primary: var(--md-sys-color-primary);
  --md-sys-color-on-primary: var(--md-sys-color-on-primary);
}

.error-button {
  --md-sys-color-primary: var(--md-sys-color-error);
  --md-sys-color-on-primary: var(--md-sys-color-on-error);
}

/* 左右面板等宽，中间为弹性间距（随视口缩放） */
.management-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.management-row {
  display: grid;
  flex: 1;
  align-items: stretch;
  gap: clamp(var(--spacing-3), 3vw, var(--spacing-10));
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.management-row > .panel-col {
  min-width: 0;
}

/* 页面 Overlay 样式 */
.page-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--color-scrim-012);
  backdrop-filter: blur(4px);
}
</style>
