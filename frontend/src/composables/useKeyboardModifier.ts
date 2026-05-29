/**
 * 增强版键盘快捷键管理（支持 Vue 风格的修饰符语法）
 *
 * 提供更接近 Vue 3 模板修饰符的 API
 */
import { useKeyboard, type KeyboardShortcut } from './useKeyboard'

/**
 * 解析 Vue 风格的快捷键字符串
 *
 * @example
 * parseModifierString('ctrl.enter') // { key: 'enter', ctrl: true }
 * parseModifierString('alt.shift.s') // { key: 's', alt: true, shift: true }
 * parseModifierString('meta.k') // { key: 'k', meta: true }
 */
export function parseModifierString(modifierString: string): Partial<KeyboardShortcut> {
  const parts = modifierString.toLowerCase().split('.')
  const key = parts[parts.length - 1] // 最后一个是按键

  const modifiers: Partial<KeyboardShortcut> = {}
  if (key) {
    modifiers.key = key
  }

  // 解析修饰键
  if (parts.includes('ctrl')) modifiers.ctrl = true
  if (parts.includes('alt')) modifiers.alt = true
  if (parts.includes('shift')) modifiers.shift = true
  if (parts.includes('meta')) modifiers.meta = true

  return modifiers
}

/**
 * 使用 Vue 风格修饰符语法注册快捷键
 *
 * @example
 * ```typescript
 * const { on } = useKeyboardModifier()
 *
 * // Vue 风格的语法
 * on('ctrl.s', () => console.log('保存'), '保存文档')
 * on('alt.m', () => console.log('管理'), '打开管理页面')
 * on('enter', () => console.log('确认'), '确认操作')
 * on('ctrl.shift.z', () => console.log('重做'), '重做')
 * ```
 */
export function useKeyboardModifier() {
  const { register, unregister, clear, getShortcuts } = useKeyboard()

  /**
   * 使用修饰符字符串注册快捷键（类似 @keydown.ctrl.enter）
   *
   * @param modifierString - 修饰符字符串，如 'ctrl.enter', 'alt.shift.s'
   * @param handler - 回调函数
   * @param description - 描述
   * @param options - 其他选项
   */
  function on(
    modifierString: string,
    handler: (event: KeyboardEvent) => void,
    description?: string,
    options?: Partial<Pick<KeyboardShortcut, 'preventDefault' | 'stopPropagation' | 'allowInInput'>>
  ): () => void {
    const modifiers = parseModifierString(modifierString)

    return register({
      ...modifiers,
      ...options,
      handler,
      description
    } as KeyboardShortcut)
  }

  /**
   * 注销快捷键
   */
  function off(modifierString: string): void {
    const modifiers = parseModifierString(modifierString)
    unregister(modifiers as KeyboardShortcut)
  }

  return {
    on,
    off,
    clear,
    getShortcuts
  }
}

/**
 * 常用修饰符快捷键预设（Vue 风格）
 */
export const ModifierShortcuts = {
  /** 保存 - Ctrl/Cmd + S */
  SAVE: 'ctrl.s',

  /** 撤销 - Ctrl/Cmd + Z */
  UNDO: 'ctrl.z',

  /** 重做 - Ctrl/Cmd + Shift + Z */
  REDO: 'ctrl.shift.z',

  /** 筛选 - Ctrl/Cmd + F */
  SEARCH: 'ctrl.f',

  /** 全选 - Ctrl/Cmd + A */
  SELECT_ALL: 'ctrl.a',

  /** 复制 - Ctrl/Cmd + C */
  COPY: 'ctrl.c',

  /** 粘贴 - Ctrl/Cmd + V */
  PASTE: 'ctrl.v',

  /** 剪切 - Ctrl/Cmd + X */
  CUT: 'ctrl.x',

  /** Enter */
  ENTER: 'enter',

  /** Escape */
  ESCAPE: 'esc',

  /** Delete */
  DELETE: 'delete',

  /** Tab */
  TAB: 'tab',

  /** 空格 */
  SPACE: 'space',

  /** 方向键 */
  ARROW_UP: 'up',
  ARROW_DOWN: 'down',
  ARROW_LEFT: 'left',
  ARROW_RIGHT: 'right'
} as const
