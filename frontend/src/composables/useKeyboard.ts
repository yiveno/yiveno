import { onMounted, onUnmounted, type Ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 键盘快捷键配置
 */
export interface KeyboardShortcut {
  /** 按键（小写），如 'a', 'enter', 'escape' */
  key: string
  /** 是否需要 Ctrl/Cmd 键 */
  ctrl?: boolean | undefined
  /** 是否需要 Alt 键 */
  alt?: boolean | undefined
  /** 是否需要 Shift 键 */
  shift?: boolean | undefined
  /** 是否需要 Meta 键（Mac Command / Windows 键） */
  meta?: boolean | undefined
  /** 回调函数 */
  handler: (event: KeyboardEvent) => void
  /** 是否阻止默认行为（默认 true） */
  preventDefault?: boolean | undefined
  /** 是否阻止事件冒泡（默认 false） */
  stopPropagation?: boolean | undefined
  /** 描述（用于调试和文档） */
  description?: string | undefined
  /** 是否在输入元素中也触发（默认 false） */
  allowInInput?: boolean | undefined
}

/**
 * 快捷键选项
 */
export interface UseKeyboardOptions {
  /** 是否全局监听（默认 true） */
  global?: boolean | undefined
  /** 目标元素（如果不是全局监听） */
  target?: Ref<HTMLElement | null> | HTMLElement | null | undefined
  /** 是否启用（默认 true） */
  enabled?: Ref<boolean> | boolean | undefined
  /** 是否在输入元素中禁用快捷键（默认 true） */
  disableInInput?: boolean | undefined
}

/**
 * 判断事件目标是否为输入元素
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toUpperCase()
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * 判断快捷键是否匹配
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const key = event.key.toLowerCase()

  // 基本按键匹配
  if (key !== shortcut.key.toLowerCase()) return false

  // 修饰键匹配
  // 注意：只检查快捷键配置中明确要求的修饰键
  // 如果快捷键没有要求某个修饰键，则不检查该修饰键的状态

  // Ctrl/Cmd 键匹配
  if (shortcut.ctrl !== undefined) {
    const hasCtrl = event.ctrlKey || event.metaKey
    if (shortcut.ctrl !== hasCtrl) return false
  }

  // Alt 键匹配
  if (shortcut.alt !== undefined) {
    if (shortcut.alt !== event.altKey) return false
  }

  // Shift 键匹配
  if (shortcut.shift !== undefined) {
    if (shortcut.shift !== event.shiftKey) return false
  }

  // Meta 键匹配（Mac Command / Windows 键）
  if (shortcut.meta !== undefined) {
    if (shortcut.meta !== event.metaKey) return false
  }

  return true
}

/**
 * 格式化快捷键显示文本
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.meta) parts.push('Meta')

  parts.push(shortcut.key.toUpperCase())

  return parts.join(' + ')
}

/**
 * 键盘快捷键管理 Composable
 *
 * @example
 * // 基础使用
 * const { register, unregister } = useKeyboard()
 *
 * register({
 *   key: 's',
 *   ctrl: true,
 *   handler: () => console.log('保存'),
 *   description: '保存文档'
 * })
 *
 * @example
 * // 局部作用域
 * const containerRef = ref<HTMLElement | null>(null)
 * const { register } = useKeyboard({
 *   global: false,
 *   target: containerRef
 * })
 *
 * @example
 * // 条件启用
 * const isEditing = ref(false)
 * const { register } = useKeyboard({
 *   enabled: isEditing
 * })
 */
export function useKeyboard(options: UseKeyboardOptions = {}) {
  const {
    global = true,
    target: targetOption = null,
    enabled: enabledOption = true,
    disableInInput = true
  } = options

  // 存储所有注册的快捷键
  const shortcuts = new Map<string, KeyboardShortcut>()

  // 快捷键处理器
  const handleKeydown = (event: KeyboardEvent) => {
    // 检查是否启用
    const isEnabled = typeof enabledOption === 'boolean' ? enabledOption : enabledOption.value

    if (!isEnabled) return

    // 检查是否在输入元素中
    if (disableInInput && isInputElement(event.target)) {
      return
    }

    // 遍历所有快捷键，找到匹配的
    for (const shortcut of shortcuts.values()) {
      // 如果快捷键不允许在输入元素中触发，且当前在输入元素中，跳过
      if (!shortcut.allowInInput && isInputElement(event.target)) {
        continue
      }

      if (matchesShortcut(event, shortcut)) {
        logger.info('Keyboard', `✅ 触发快捷键: ${formatShortcut(shortcut)}`, shortcut.description)

        // 阻止默认行为
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }

        // 阻止事件冒泡
        if (shortcut.stopPropagation) {
          event.stopPropagation()
        }

        // 执行回调
        try {
          shortcut.handler(event)
        } catch (error) {
          logger.error('Keyboard', `快捷键处理器执行失败: ${formatShortcut(shortcut)}`, error)
        }

        // 找到第一个匹配的快捷键后就停止
        break
      }
    }
  }

  /**
   * 注册快捷键
   */
  function register(shortcut: KeyboardShortcut): () => void {
    const id = formatShortcut(shortcut)

    // 检查是否已存在
    if (shortcuts.has(id)) {
      logger.warn('Keyboard', `快捷键 ${id} 已存在，将被覆盖`)
    }

    shortcuts.set(id, shortcut)
    logger.debug('Keyboard', `注册快捷键: ${id}`, shortcut.description)

    // 返回注销函数
    return () => unregister(shortcut)
  }

  /**
   * 注销快捷键
   */
  function unregister(shortcut: KeyboardShortcut): void {
    const id = formatShortcut(shortcut)
    shortcuts.delete(id)
    logger.debug('Keyboard', `注销快捷键: ${id}`)
  }

  /**
   * 清空所有快捷键
   */
  function clear(): void {
    shortcuts.clear()
    logger.debug('Keyboard', '清空所有快捷键')
  }

  /**
   * 获取所有已注册的快捷键
   */
  function getShortcuts(): ReadonlyMap<string, KeyboardShortcut> {
    return shortcuts
  }

  // 挂载时添加事件监听
  onMounted(() => {
    let targetElement: EventTarget | null = null
    if (global) {
      targetElement = window
    } else if (targetOption && 'value' in targetOption) {
      targetElement = targetOption.value
    } else if (targetOption) {
      targetElement = targetOption
    }

    if (targetElement) {
      targetElement.addEventListener('keydown', handleKeydown as EventListener)
      logger.debug('Keyboard', '键盘监听已启动', {
        global,
        target: targetElement
      })
    } else {
      logger.warn('Keyboard', '目标元素不存在，键盘监听未启动')
    }
  })

  // 卸载时移除事件监听
  onUnmounted(() => {
    let targetElement: EventTarget | null = null
    if (global) {
      targetElement = window
    } else if (targetOption && 'value' in targetOption) {
      targetElement = targetOption.value
    } else if (targetOption) {
      targetElement = targetOption
    }

    if (targetElement) {
      ;(targetElement as EventTarget).removeEventListener('keydown', handleKeydown as EventListener)
      logger.debug('Keyboard', '键盘监听已停止')
    }

    // 清空所有快捷键
    clear()
  })

  return {
    register,
    unregister,
    clear,
    getShortcuts
  }
}

/**
 * 常用快捷键预设
 */
export const CommonShortcuts = {
  /** Ctrl/Cmd + S - 保存 */
  save: (handler: () => void): KeyboardShortcut => ({
    key: 's',
    ctrl: true,
    handler,
    description: '保存'
  }),

  /** Ctrl/Cmd + Z - 撤销 */
  undo: (handler: () => void): KeyboardShortcut => ({
    key: 'z',
    ctrl: true,
    handler,
    description: '撤销'
  }),

  /** Ctrl/Cmd + Shift + Z - 重做 */
  redo: (handler: () => void): KeyboardShortcut => ({
    key: 'z',
    ctrl: true,
    shift: true,
    handler,
    description: '重做'
  }),

  /** Ctrl/Cmd + F - 筛选 */
  search: (handler: () => void): KeyboardShortcut => ({
    key: 'f',
    ctrl: true,
    handler,
    description: '筛选'
  }),

  /** Escape - 取消/关闭 */
  escape: (handler: () => void): KeyboardShortcut => ({
    key: 'escape',
    handler,
    description: '取消/关闭'
  }),

  /** Enter - 确认 */
  enter: (handler: () => void): KeyboardShortcut => ({
    key: 'enter',
    handler,
    description: '确认'
  }),

  /** Delete/Backspace - 删除 */
  delete: (handler: () => void): KeyboardShortcut => ({
    key: 'delete',
    handler,
    description: '删除'
  }),

  /** Arrow Keys - 导航 */
  arrowUp: (handler: () => void): KeyboardShortcut => ({
    key: 'arrowup',
    handler,
    description: '向上'
  }),

  arrowDown: (handler: () => void): KeyboardShortcut => ({
    key: 'arrowdown',
    handler,
    description: '向下'
  }),

  arrowLeft: (handler: () => void): KeyboardShortcut => ({
    key: 'arrowleft',
    handler,
    description: '向左'
  }),

  arrowRight: (handler: () => void): KeyboardShortcut => ({
    key: 'arrowright',
    handler,
    description: '向右'
  })
} as const
