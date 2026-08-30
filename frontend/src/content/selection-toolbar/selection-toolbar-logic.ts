/** mouseup 后延迟展示，避开 Chrome / 站点自带选区条的短暂空选区。 */
export const SELECTION_TOOLBAR_SHOW_DELAY_MS = 120

/** 划词浮层定位与可见性纯函数（无 DOM 依赖）。 */

export interface SelectionToolbarAnchor {
  top: number
  left: number
}

/** 根据选区矩形计算浮层位置（viewport 坐标，供 fixed 定位）。 */
export function computeSelectionToolbarAnchor(
  rect: {
    top: number
    left: number
    width: number
    height: number
  },
  options: { estimatedHeight?: number } = {}
): SelectionToolbarAnchor {
  const toolbarOffset = 8
  const estimatedToolbarHeight = options.estimatedHeight ?? 36
  const topAbove = rect.top - estimatedToolbarHeight - toolbarOffset
  const top = topAbove >= 8 ? topAbove : rect.top + rect.height + toolbarOffset

  const left = Math.max(8, rect.left + rect.width / 2)

  return { top, left }
}

/** 选区文本是否值得展示浮层。 */
export function shouldShowSelectionToolbar(input: {
  enabled: boolean
  selectedText: string
  isSavablePage: boolean
}): boolean {
  if (!input.enabled || !input.isSavablePage) {
    return false
  }
  return input.selectedText.trim().length > 0
}

/**
 * selectionchange 空选区时是否应立刻收起浮层。
 * mouseup 后 120ms 内许多页面 / Chrome 自带选区条会短暂清选区；
 * 若此时 hide，会取消已排程弹出并清掉快照，表现为「开关开着也不出菜单」。
 */
export function shouldHideToolbarOnEmptySelection(input: {
  /** 是否已排程延迟展示 */
  showTimerPending: boolean
  /** 是否仍有 mouseup 时留下的选区快照 */
  hasPendingCapture: boolean
  /** 浮层是否已在展示 */
  toolbarVisible: boolean
}): boolean {
  if (input.showTimerPending) {
    return false
  }
  if (input.hasPendingCapture && input.toolbarVisible) {
    return false
  }
  return true
}

/** 选区锚点矩形（viewport 坐标）；无有效矩形时返回 null。 */
export interface SelectionAnchorRect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * 从 Range 解析锚点矩形。
 * 部分 CJK / 跨行选区 `getBoundingClientRect()` 可能为 0，回退 `getClientRects` 合并。
 */
export function resolveSelectionAnchorRect(range: {
  getBoundingClientRect: () => DOMRect
  getClientRects: () => DOMRectList | readonly DOMRect[]
}): SelectionAnchorRect | null {
  const primary = range.getBoundingClientRect()
  if (primary.width > 0 || primary.height > 0) {
    return {
      top: primary.top,
      left: primary.left,
      width: primary.width,
      height: primary.height
    }
  }

  const clientRects = range.getClientRects()
  if (clientRects.length === 0) {
    return null
  }

  let top = Infinity
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const rect of clientRects) {
    if (rect.width === 0 && rect.height === 0) {
      continue
    }
    top = Math.min(top, rect.top)
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  if (!Number.isFinite(top) || right <= left || bottom <= top) {
    return null
  }

  return {
    top,
    left,
    width: right - left,
    height: bottom - top
  }
}
