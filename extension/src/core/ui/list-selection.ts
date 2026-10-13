/**
 * 线性列表选中下标（消费通用键盘意图的一种业务适配，非按键本身）。
 */

/** 导航方向 → 列表步进（仅上下；左右由调用方另处理或忽略）。 */
export function listDeltaFromNavigateDirection(
  direction: 'up' | 'down' | 'left' | 'right'
): -1 | 1 | null {
  if (direction === 'down') {
    return 1
  }
  if (direction === 'up') {
    return -1
  }
  return null
}

/**
 * 计算移动后的选中下标。
 * - 当前无选中（越界）时：向下 → 0，向上 → 末项
 * - 已在合法下标：步进后钳制在 [0, itemCount)，不循环
 * - itemCount 为 0 时返回 -1
 */
export function moveListSelectionIndex(input: {
  currentIndex: number
  itemCount: number
  delta: -1 | 1
}): number {
  const { itemCount, delta } = input
  if (itemCount <= 0) {
    return -1
  }

  const current = input.currentIndex
  if (current < 0 || current >= itemCount) {
    return delta > 0 ? 0 : itemCount - 1
  }

  return clampListSelectionIndex(current + delta, itemCount)
}

/** 将下标钳到合法范围；无项时为 -1。 */
export function clampListSelectionIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return -1
  }
  if (index < 0) {
    return 0
  }
  if (index >= itemCount) {
    return itemCount - 1
  }
  return index
}
