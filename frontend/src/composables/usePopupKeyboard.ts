/**
 * Popup 页面键盘快捷键管理
 *
 * 集中管理 Popup 页面的所有键盘快捷键，提升代码可维护性
 */
import { useKeyboard } from './useKeyboard'

/**
 * Popup 页面快捷键处理器
 */
export interface PopupKeyboardHandlers {
  /** 打开整理页面 */
  openManagement: () => void
  /** 打开设置页面 */
  openSettings?: () => void
  /** 刷新数据 */
  refresh?: () => void
}

/**
 * Popup 页面键盘快捷键
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { usePopupKeyboard } from '@/composables/usePopupKeyboard'
 *
 * usePopupKeyboard({
 *   openManagement: () => { ... }
 * })
 * </script>
 * ```
 */
export function usePopupKeyboard(handlers: PopupKeyboardHandlers) {
  const { register } = useKeyboard()

  // Alt + M - 打开整理页面
  register({
    key: 'm',
    alt: true,
    handler: handlers.openManagement,
    description: '打开书签整理页面'
  })

  // Alt + S - 打开设置页面（可选）
  if (handlers.openSettings) {
    register({
      key: 's',
      alt: true,
      handler: handlers.openSettings,
      description: '打开设置页面'
    })
  }

  // Ctrl/Cmd + R - 刷新数据（可选）
  if (handlers.refresh) {
    register({
      key: 'r',
      ctrl: true,
      handler: handlers.refresh,
      description: '刷新书签数据'
    })
  }

  // F5 - 刷新数据（可选）
  if (handlers.refresh) {
    register({
      key: 'f5',
      handler: handlers.refresh,
      description: '刷新书签数据'
    })
  }
}
