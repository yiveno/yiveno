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
