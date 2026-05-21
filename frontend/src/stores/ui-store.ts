/**
 * 通用UI状态管理Store
 * 管理全局UI状态，如Snackbar、对话框、加载状态等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notify } from '@/application/notification/notification-service'

/**
 * Snackbar 状态接口
 */
export interface SnackbarState {
  /** 是否显示 */
  show: boolean
  /** 显示文本 */
  text: string
  /** 颜色类型 */
  color: 'success' | 'error' | 'warning' | 'info'
  /** 自动隐藏时长（毫秒） */
  timeout: number
}

/**
 * 对话框状态接口
 */
export interface DialogState {
  /** 是否显示 */
  show: boolean
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 确认按钮文本 */
  confirmText: string
  /** 取消按钮文本 */
  cancelText: string
  /** 确认回调函数 */
  onConfirm?: () => void
  /** 取消回调函数 */
  onCancel?: () => void
}

/**
 * 加载状态接口
 */
export interface LoadingState {
  /** 是否正在加载 */
  isLoading: boolean
  /** 加载提示消息 */
  message: string
  /** 当前进度 */
  progress: number
  /** 总数 */
  total: number
}

/**
 * UI状态管理 Store
 *
 * 职责：
 * - 管理全局 UI 状态（Snackbar、对话框、加载状态等）
 * - 提供统一的消息提示接口
 * - 管理页面状态和错误状态
 */
export const useUIStore = defineStore('ui', () => {
  // === 状态 ===

  /** Snackbar 状态 */
  const snackbar = ref<SnackbarState>({
    show: false,
    text: '',
    color: 'info',
    timeout: 2000
  })

  /** 确认对话框状态 */
  const confirmDialog = ref<DialogState>({
    show: false,
    title: '',
    content: '',
    confirmText: '确认',
    cancelText: '取消',
    onConfirm: undefined,
    onCancel: undefined
  })

  /** 全局加载状态 */
  const loading = ref<LoadingState>({
    isLoading: false,
    message: '加载中...',
    progress: 0,
    total: 0
  })

  /** 当前页面标识 */
  const currentPage = ref<string>('') // 'popup', 'management', 'search', 'debug'
  /** 页面标题 */
  const pageTitle = ref<string>('')

  /** 最后一次错误消息 */
  const lastError = ref<string | null>(null)
  /** 错误计数 */
  const errorCount = ref<number>(0)

  // === 书签状态管理 ===
  
  /** 选中的书签ID集合（用于批量操作） */
  const selectedBookmarkIds = ref<Set<string>>(new Set())
  
  /** 当前激活的书签ID（表示当前打开页面对应的书签，用于 SidePanel） */
  const activeBookmarkId = ref<string | null>(null)
  
  /** 键盘导航焦点的书签ID - Popup 面板（用于方向键导航） */
  const focusedBookmarkIdPopup = ref<string | null>(null)
  
  /** 键盘导航焦点的书签ID - SidePanel 面板（用于方向键导航） */
  const focusedBookmarkIdSidePanel = ref<string | null>(null)

  // === 计算属性 ===

  /**
   * 加载进度百分比
   */
  const loadingPercent = computed(() => {
    if (loading.value.total === 0) return 0
    return Math.round((loading.value.progress / loading.value.total) * 100)
  })

  /**
   * 是否有活动的对话框
   */
  const hasActiveDialog = computed(() => {
    return confirmDialog.value.show
  })

  /**
   * 是否存在错误
   */
  const hasError = computed(() => {
    return lastError.value !== null
  })

  // === 动作 ===

  /**
   * 显示 Snackbar 消息
   *
   * @param text - 消息文本
   * @param color - 消息类型（success/error/warning/info）
   * @param timeout - 自动隐藏时长（毫秒），默认 2000
   */
  function showSnackbar(
    text: string,
    color: SnackbarState['color'] = 'info',
    timeout: number = 2000
  ) {
    // 统一路由到系统通知队列
    notify(text, { level: color, timeoutMs: timeout })
    // 保持状态但不触发页面内 Toast 显示，减少DOM抖动
    snackbar.value = {
      show: false,
      text,
      color,
      timeout
    }
  }

  /**
   * 隐藏Snackbar
   */
  function hideSnackbar() {
    snackbar.value.show = false
  }

  /**
   * 显示成功消息
   */
  function showSuccess(text: string, timeout: number = 2000) {
    showSnackbar(text, 'success', timeout)
  }

  /**
   * 显示错误消息
   */
  function showError(text: string, timeout: number = 5000) {
    showSnackbar(text, 'error', timeout)
    lastError.value = text
    errorCount.value++
  }

  /**
   * 显示警告消息
   */
  function showWarning(text: string, timeout: number = 4000) {
    showSnackbar(text, 'warning', timeout)
  }

  /**
   * 显示信息消息
   */
  function showInfo(text: string, timeout: number = 2000) {
    showSnackbar(text, 'info', timeout)
  }

  /**
   * 显示确认对话框
   */
  function showConfirm(
    title: string,
    content: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText: string = '确认',
    cancelText: string = '取消'
  ) {
    confirmDialog.value = {
      show: true,
      title,
      content,
      confirmText,
      cancelText,
      onConfirm,
      onCancel
    }
  }

  /**
   * 隐藏确认对话框
   */
  function hideConfirm() {
    confirmDialog.value.show = false
    confirmDialog.value.onConfirm = undefined
    confirmDialog.value.onCancel = undefined
  }

  /**
   * 确认对话框 - 确认按钮
   */
  function confirmAction() {
    if (confirmDialog.value.onConfirm) {
      confirmDialog.value.onConfirm()
    }
    hideConfirm()
  }

  /**
   * 确认对话框 - 取消按钮
   */
  function cancelAction() {
    if (confirmDialog.value.onCancel) {
      confirmDialog.value.onCancel()
    }
    hideConfirm()
  }

  /**
   * 设置加载状态
   */
  function setLoading(
    isLoading: boolean,
    message: string = '加载中...',
    progress: number = 0,
    total: number = 0
  ) {
    loading.value = {
      isLoading,
      message,
      progress,
      total
    }
  }

  /**
   * 开始加载
   */
  function startLoading(message: string = '加载中...') {
    setLoading(true, message)
  }

  /**
   * 结束加载
   */
  function stopLoading() {
    setLoading(false)
  }

  /**
   * 更新加载进度
   */
  function updateProgress(progress: number, total: number, message?: string) {
    loading.value.progress = progress
    loading.value.total = total
    if (message) {
      loading.value.message = message
    }
  }

  /**
   * 设置当前页面
   */
  function setCurrentPage(page: string, title: string = '') {
    currentPage.value = page
    pageTitle.value = title
  }

  /**
   * 清除错误状态
   */
  function clearError() {
    lastError.value = null
  }

  /**
   * 清除所有状态
   */
  function reset() {
    hideSnackbar()
    hideConfirm()
    stopLoading()
    clearError()
  }

  // === 书签状态管理动作 ===
  
  /**
   * 设置激活的书签ID（用于 SidePanel 当前页面高亮）
   * @param id - 书签ID，null 表示清除激活状态
   */
  function setActiveBookmark(id: string | null) {
    activeBookmarkId.value = id
  }
  
  /**
   * 清除激活状态
   */
  function clearActiveBookmark() {
    activeBookmarkId.value = null
  }
  
  /**
   * 设置键盘导航焦点的书签ID（Popup 面板）
   * @param id - 书签ID，null 表示清除焦点
   */
  function setFocusedBookmarkPopup(id: string | null) {
    focusedBookmarkIdPopup.value = id
    // ✅ 切换面板时，清除另一个面板的焦点
    if (id !== null) {
      focusedBookmarkIdSidePanel.value = null
    }
  }
  
  /**
   * 清除键盘导航焦点（Popup 面板）
   */
  function clearFocusedBookmarkPopup() {
    focusedBookmarkIdPopup.value = null
  }
  
  /**
   * 设置键盘导航焦点的书签ID（SidePanel 面板）
   * @param id - 书签ID，null 表示清除焦点
   */
  function setFocusedBookmarkSidePanel(id: string | null) {
    focusedBookmarkIdSidePanel.value = id
    // ✅ 切换面板时，清除另一个面板的焦点
    if (id !== null) {
      focusedBookmarkIdPopup.value = null
    }
  }
  
  /**
   * 清除键盘导航焦点（SidePanel 面板）
   */
  function clearFocusedBookmarkSidePanel() {
    focusedBookmarkIdSidePanel.value = null
  }
  
  /**
   * 切换书签选中状态
   * @param id - 书签ID
   */
  function toggleBookmarkSelection(id: string) {
    if (selectedBookmarkIds.value.has(id)) {
      selectedBookmarkIds.value.delete(id)
    } else {
      selectedBookmarkIds.value.add(id)
    }
    // 强制触发响应式更新
    selectedBookmarkIds.value = new Set(selectedBookmarkIds.value)
  }
  
  /**
   * 清除所有选中状态
   */
  function clearBookmarkSelection() {
    selectedBookmarkIds.value.clear()
    selectedBookmarkIds.value = new Set()
  }
  
  /**
   * 批量选中书签
   * @param ids - 书签ID数组
   */
  function selectBookmarks(ids: string[]) {
    selectedBookmarkIds.value = new Set(ids)
  }

  // 返回公共API
  return {
    // 状态
    snackbar,
    confirmDialog,
    loading,
    currentPage,
    pageTitle,
    lastError,
    errorCount,
    selectedBookmarkIds,
    activeBookmarkId,
    focusedBookmarkIdPopup,
    focusedBookmarkIdSidePanel,

    // 计算属性
    loadingPercent,
    hasActiveDialog,
    hasError,

    // 动作
    showSnackbar,
    hideSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    hideConfirm,
    confirmAction,
    cancelAction,
    setLoading,
    startLoading,
    stopLoading,
    updateProgress,
    setCurrentPage,
    clearError,
    reset,
    // 书签状态管理
    setActiveBookmark,
    clearActiveBookmark,
    setFocusedBookmarkPopup,
    clearFocusedBookmarkPopup,
    setFocusedBookmarkSidePanel,
    clearFocusedBookmarkSidePanel,
    toggleBookmarkSelection,
    clearBookmarkSelection,
    selectBookmarks
  }
})
