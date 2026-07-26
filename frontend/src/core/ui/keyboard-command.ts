/**
 * 通用键盘意图（与列表 / 树 / 网格等业务无关）。
 * UI 壳自行把意图映射到各自状态机。
 */

export type KeyboardCommand =
  | { type: 'navigate'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'confirm' }
  | { type: 'none' }

export interface KeyboardEventLike {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  isComposing?: boolean
}

/**
 * 将物理按键解释为通用意图。
 * - 方向键 → navigate
 * - 裸 Enter → confirm（忽略 IME 合成中与带修饰键）
 * - 其余 → none（调用方勿 preventDefault）
 */
export function interpretKeyboardCommand(event: KeyboardEventLike): KeyboardCommand {
  if (event.isComposing) {
    return { type: 'none' }
  }

  switch (event.key) {
    case 'ArrowUp':
      return { type: 'navigate', direction: 'up' }
    case 'ArrowDown':
      return { type: 'navigate', direction: 'down' }
    case 'ArrowLeft':
      return { type: 'navigate', direction: 'left' }
    case 'ArrowRight':
      return { type: 'navigate', direction: 'right' }
    case 'Enter':
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return { type: 'none' }
      }
      return { type: 'confirm' }
    default:
      return { type: 'none' }
  }
}
