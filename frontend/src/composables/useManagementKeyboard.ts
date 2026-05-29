/**
 * Management 页面键盘快捷键管理
 *
 * 提供书签管理、清理、批量操作的快捷键
 */
import { useKeyboard, CommonShortcuts } from './useKeyboard'

/**
 * Management 页面快捷键处理器
 */
export interface ManagementKeyboardHandlers {
  /** 保存更改 */
  save?: () => void
  /** 撤销 */
  undo?: () => void
  /** 重做 */
  redo?: () => void
  /** 删除选中项 */
  deleteSelected?: () => void
  /** 全选 */
  selectAll?: () => void
  /** 取消选择 */
  clearSelection?: () => void
  /** 聚焦筛选输入框 */
  focusSearch?: () => void
  /** 刷新数据 */
  refresh?: () => void
  /** 展开所有文件夹 */
  expandAll?: () => void
  /** 折叠所有文件夹 */
  collapseAll?: () => void
  /** 关闭当前对话框/面板 */
  closeDialog?: () => void
}

/**
 * Management 页面键盘快捷键
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useManagementKeyboard } from '@/composables/useManagementKeyboard'
 *
 * useManagementKeyboard({
 *   save: () => { ... },
 *   deleteSelected: () => { ... },
 *   focusSearch: () => { ... }
 * })
 * </script>
 * ```
 */
export function useManagementKeyboard(handlers: ManagementKeyboardHandlers) {
  const { register } = useKeyboard()

  // Ctrl/Cmd + S - 保存
  if (handlers.save) {
    register(CommonShortcuts.save(handlers.save))
  }

  // Ctrl/Cmd + Z - 撤销
  if (handlers.undo) {
    register(CommonShortcuts.undo(handlers.undo))
  }

  // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y - 重做
  if (handlers.redo) {
    register(CommonShortcuts.redo(handlers.redo))

    register({
      key: 'y',
      ctrl: true,
      handler: handlers.redo,
      description: '重做'
    })
  }

  // Delete 或 Backspace - 删除选中项
  if (handlers.deleteSelected) {
    register(CommonShortcuts.delete(handlers.deleteSelected))

    register({
      key: 'backspace',
      handler: handlers.deleteSelected,
      description: '删除选中项'
    })
  }

  // Ctrl/Cmd + A - 全选
  if (handlers.selectAll) {
    register({
      key: 'a',
      ctrl: true,
      handler: handlers.selectAll,
      description: '全选'
    })
  }

  // Escape - 取消选择或关闭对话框
  if (handlers.clearSelection) {
    register({
      key: 'escape',
      handler: () => {
        // 优先关闭对话框
        if (handlers.closeDialog) {
          handlers.closeDialog()
        } else if (handlers.clearSelection) {
          handlers.clearSelection()
        }
      },
      description: '取消选择或关闭对话框'
    })
  } else if (handlers.closeDialog) {
    register(CommonShortcuts.escape(handlers.closeDialog))
  }

  // Ctrl/Cmd + F - 聚焦筛选输入框
  if (handlers.focusSearch) {
    register(CommonShortcuts.search(handlers.focusSearch))
  }

  // F5 或 Ctrl/Cmd + R - 刷新
  if (handlers.refresh) {
    register({
      key: 'f5',
      handler: handlers.refresh,
      description: '刷新数据'
    })

    register({
      key: 'r',
      ctrl: true,
      handler: handlers.refresh,
      description: '刷新数据'
    })
  }

  // Ctrl/Cmd + Shift + E - 展开所有
  if (handlers.expandAll) {
    register({
      key: 'e',
      ctrl: true,
      shift: true,
      handler: handlers.expandAll,
      description: '展开所有文件夹'
    })
  }

  // Ctrl/Cmd + Shift + C - 折叠所有
  if (handlers.collapseAll) {
    register({
      key: 'c',
      ctrl: true,
      shift: true,
      handler: handlers.collapseAll,
      description: '折叠所有文件夹'
    })
  }
}
