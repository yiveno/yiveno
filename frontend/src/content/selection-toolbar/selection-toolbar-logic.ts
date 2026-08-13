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
