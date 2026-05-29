/**
 * SidePanel 页面键盘快捷键管理
 *
 * 提供书签浏览、收藏管理的快捷键
 */
import { useKeyboard, CommonShortcuts } from './useKeyboard'

/**
 * SidePanel 页面快捷键处理器
 */
export interface SidePanelKeyboardHandlers {
  /** 刷新数据 */
  refresh?: () => void
  /** 打开当前选中的书签 */
  openSelected?: () => void
  /** 收藏/取消收藏当前选中的书签 */
  toggleFavorite?: () => void
  /** 打开设置页面 */
  openSettings?: () => void
  /** 关闭侧边栏 */
  closeSidePanel?: () => void
}

/**
 * SidePanel 页面键盘快捷键
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useSidePanelKeyboard } from '@/composables/useSidePanelKeyboard'
 *
 * useSidePanelKeyboard({
 *   refresh: () => { ... },
 *   openSelected: () => { ... },
 *   toggleFavorite: () => { ... }
 * })
 * </script>
 * ```
 */
export function useSidePanelKeyboard(handlers: SidePanelKeyboardHandlers) {
  const { register } = useKeyboard()

  // F5 或 Ctrl/Cmd + R - 刷新数据
  if (handlers.refresh) {
    register({
      key: 'f5',
      handler: handlers.refresh,
      description: '刷新书签数据'
    })

    register({
      key: 'r',
      ctrl: true,
      handler: handlers.refresh,
      description: '刷新书签数据'
    })
  }

  // Enter - 打开选中的书签
  if (handlers.openSelected) {
    register(CommonShortcuts.enter(handlers.openSelected))
  }

  // F - 收藏/取消收藏
  if (handlers.toggleFavorite) {
    register({
      key: 'f',
      handler: handlers.toggleFavorite,
      description: '切换书签收藏状态'
    })
  }

  // Ctrl/Cmd + , - 打开设置
  if (handlers.openSettings) {
    register({
      key: ',',
      ctrl: true,
      handler: handlers.openSettings,
      description: '打开设置页面'
    })
  }

  // Escape - 关闭侧边栏
  if (handlers.closeSidePanel) {
    register(CommonShortcuts.escape(handlers.closeSidePanel))
  }
}
