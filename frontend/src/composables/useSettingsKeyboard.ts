/**
 * Settings 页面键盘快捷键管理
 *
 * 提供设置页面导航、保存、重置的快捷键
 */
import { useKeyboard, CommonShortcuts } from './useKeyboard'

/**
 * Settings 页面快捷键处理器
 */
export interface SettingsKeyboardHandlers {
  /** 保存设置 */
  save?: () => void
  /** 重置设置 */
  reset?: () => void
  /** 导出设置 */
  export?: () => void
  /** 导入设置 */
  import?: () => void
  /** 关闭设置页面 */
  close?: () => void
  /** 切换到下一个标签页 */
  nextTab?: () => void
  /** 切换到上一个标签页 */
  prevTab?: () => void
}

/**
 * Settings 页面键盘快捷键
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useSettingsKeyboard } from '@/composables/useSettingsKeyboard'
 *
 * useSettingsKeyboard({
 *   save: () => { ... },
 *   close: () => { ... },
 *   nextTab: () => { ... }
 * })
 * </script>
 * ```
 */
export function useSettingsKeyboard(handlers: SettingsKeyboardHandlers) {
  const { register } = useKeyboard()

  // Ctrl/Cmd + S - 保存设置
  if (handlers.save) {
    register(CommonShortcuts.save(handlers.save))
  }

  // Ctrl/Cmd + Shift + R - 重置设置
  if (handlers.reset) {
    register({
      key: 'r',
      ctrl: true,
      shift: true,
      handler: handlers.reset,
      description: '重置设置'
    })
  }

  // Ctrl/Cmd + E - 导出设置
  if (handlers.export) {
    register({
      key: 'e',
      ctrl: true,
      handler: handlers.export,
      description: '导出设置'
    })
  }

  // Ctrl/Cmd + I - 导入设置
  if (handlers.import) {
    register({
      key: 'i',
      ctrl: true,
      handler: handlers.import,
      description: '导入设置'
    })
  }

  // Escape - 关闭设置页面
  if (handlers.close) {
    register(CommonShortcuts.escape(handlers.close))
  }

  // Ctrl/Cmd + Tab - 下一个标签页
  if (handlers.nextTab) {
    register({
      key: 'tab',
      ctrl: true,
      handler: handlers.nextTab,
      description: '切换到下一个标签页'
    })
  }

  // Ctrl/Cmd + Shift + Tab - 上一个标签页
  if (handlers.prevTab) {
    register({
      key: 'tab',
      ctrl: true,
      shift: true,
      handler: handlers.prevTab,
      description: '切换到上一个标签页'
    })
  }

  // 数字键 1-9 - 快速切换到指定标签页（如果支持）
  // 这个可以根据实际标签页数量动态注册
}
