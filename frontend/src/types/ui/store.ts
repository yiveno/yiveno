/**
 * UI 层状态管理相关的类型。
 */
import type { BookmarkNode } from '@/types/domain/bookmark'

/** 侧边栏状态。 */
export interface SidebarState {
  /** 是否打开 */
  isOpen: boolean
  /** 当前激活的 tab */
  activeTab: 'bookmarks' | 'trait-filter' | 'settings'
}

/** Snackbar 通知条状态。 */
export interface SnackbarState {
  /** 是否显示 */
  show: boolean
  /** 展示文案 */
  text: string
  /** 颜色类型 */
  color: 'info' | 'success' | 'warning' | 'error'
  /** 停留时间（毫秒） */
  timeout: number
}

/** 通用对话框状态。 */
export interface DialogState {
  /** 是否打开 */
  isOpen: boolean
  /** 任意数据载荷 */
  data?: unknown
}

/** 树形选择状态，用于 Shift/Command 选择逻辑。 */
export interface TreeSelectionState {
  /** 当前选中节点 ID 集合 */
  selectedIds: Set<string>
  /** 最后一个选中的节点 ID */
  lastSelectedId?: string
}

/** 书签对话框 payload，标记当前操作类型。 */
export interface BookmarkDialogPayload {
  /** 目标书签节点 */
  bookmark: BookmarkNode
  /** 操作模式 */
  mode: 'edit' | 'delete'
}

/** UI Store 聚合状态。 */
export interface UIState {
  /** 侧边栏状态 */
  sidebar: SidebarState
  /** Snackbar 状态 */
  snackbar: SnackbarState
  /** 各类对话框状态 */
  dialogs: Record<string, DialogState>
  /** 树形选择状态 */
  selection: TreeSelectionState
}

/** Snackbar 默认值。 */
export const DEFAULT_SNACKBAR_STATE: SnackbarState = {
  /** 是否显示 */
  show: false,
  text: '',
  color: 'info',
  timeout: 3000
}
