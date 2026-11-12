/** mouseup 后延迟展示，避开 Chrome / 站点自带选区条的短暂空选区。 */
export const SELECTION_TOOLBAR_SHOW_DELAY_MS = 120

/** 划词浮层定位与可见性纯函数（无 DOM 依赖）。 */

export interface SelectionToolbarAnchor {
  top: number
  left: number
}

/**
 * 根据选区矩形计算浮层位置（viewport 坐标，供 fixed 定位）。
 * 可选 viewportWidth / viewportHeight / toolbarWidth：按实测宽度钳制中心点，防右/底溢出。
 * 缺省时行为与旧版一致（仅左侧 Math.max(8, centerX)）。
 */
export function computeSelectionToolbarAnchor(
  rect: {
    top: number
    left: number
    width: number
    height: number
  },
  options: {
    estimatedHeight?: number
    viewportWidth?: number
    viewportHeight?: number
    toolbarWidth?: number
  } = {}
): SelectionToolbarAnchor {
  const toolbarOffset = 8
  const estimatedToolbarHeight = options.estimatedHeight ?? 36
  const topAbove = rect.top - estimatedToolbarHeight - toolbarOffset
  const topBelow = rect.top + rect.height + toolbarOffset

  let top: number
  if (options.viewportHeight !== undefined) {
    const viewportHeight = options.viewportHeight
    if (topAbove >= 8) {
      top = topAbove
    } else if (topBelow + estimatedToolbarHeight <= viewportHeight - 8) {
      top = topBelow
    } else {
      top = Math.max(8, viewportHeight - estimatedToolbarHeight - 8)
    }
  } else {
    top = topAbove >= 8 ? topAbove : topBelow
  }

  const centerX = rect.left + rect.width / 2
  const width = options.toolbarWidth ?? 320
  let left: number
  if (options.viewportWidth !== undefined) {
    const viewportWidth = options.viewportWidth
    if (width >= viewportWidth - 16) {
      left = viewportWidth / 2
    } else {
      const minLeft = width / 2 + 8
      const maxLeft = viewportWidth - width / 2 - 8
      left = Math.min(Math.max(centerX, minLeft), maxLeft)
    }
  } else {
    left = Math.max(8, centerX)
  }

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
 * selectionchange 时是否应评估展示（键盘选区唤出）。
 * 鼠标拖拽中途不评估；只认 1000ms 内的选区类按键（防程序化选区 / contenteditable 打字误弹）。
 */
export function shouldEvaluateSelectionOnChange(input: {
  mouseDown: boolean
  msSinceSelectionKeyDown: number | null
  enabled: boolean
  selectedText: string
  isSavablePage: boolean
}): boolean {
  if (input.mouseDown) {
    return false
  }
  if (input.msSinceSelectionKeyDown === null || input.msSinceSelectionKeyDown > 1000) {
    return false
  }
  return shouldShowSelectionToolbar({
    enabled: input.enabled,
    selectedText: input.selectedText,
    isSavablePage: input.isSavablePage
  })
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

/** 附注草稿：非空 trim 才应 stash。 */
export function shouldStashNoteDraft(noteText: string): boolean {
  return noteText.trim().length > 0
}

/**
 * 草稿与当前选区是否匹配。
 * 匹配则返回草稿正文；否则 null（属另一段选区，应丢弃）。
 */
export function matchNoteDraft(
  draft: { selectedText: string; note: string } | null,
  selectedText: string
): string | null {
  if (!draft) {
    return null
  }
  if (draft.selectedText !== selectedText) {
    return null
  }
  return draft.note
}

/**
 * 按滚动差值把快照锚点换算到当前 viewport。
 * 完全出视口时返回 null（调用方应收起附注面板并保留草稿）。
 */
export function resolveScrolledSelectionAnchor(input: {
  snapshotRect: SelectionAnchorRect
  snapshotScroll: { x: number; y: number }
  currentScroll: { x: number; y: number }
  viewportWidth: number
  viewportHeight: number
}): SelectionAnchorRect | null {
  const left = input.snapshotRect.left + input.snapshotScroll.x - input.currentScroll.x
  const top = input.snapshotRect.top + input.snapshotScroll.y - input.currentScroll.y
  const right = left + input.snapshotRect.width
  const bottom = top + input.snapshotRect.height

  if (bottom < 0 || top > input.viewportHeight || right < 0 || left > input.viewportWidth) {
    return null
  }

  return {
    top,
    left,
    width: input.snapshotRect.width,
    height: input.snapshotRect.height
  }
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
