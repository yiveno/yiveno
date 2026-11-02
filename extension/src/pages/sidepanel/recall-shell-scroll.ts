/** 距顶/底 threshold 内视为「贴边」（与 Side Panel 滚动区一致）。 */
export const RECALL_SHELL_STICK_EDGE_THRESHOLD_PX = 96

/** @deprecated 用 `RECALL_SHELL_STICK_EDGE_THRESHOLD_PX`；保留别名以免外部引用断裂。 */
export const RECALL_SHELL_STICK_TO_BOTTOM_THRESHOLD_PX = RECALL_SHELL_STICK_EDGE_THRESHOLD_PX

export type RecallShellScrollState = {
  /** 距顶不足 threshold */
  nearTop: boolean
  /** 距底不足 threshold（黏底跟随新消息） */
  nearBottom: boolean
  /** 内容高于可视区（可滚） */
  canScroll: boolean
}

export function readRecallShellScrollState(
  element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  thresholdPx = RECALL_SHELL_STICK_EDGE_THRESHOLD_PX
): RecallShellScrollState {
  const overflow = element.scrollHeight - element.clientHeight
  const canScroll = overflow > 1
  if (!canScroll) {
    return { nearTop: true, nearBottom: true, canScroll: false }
  }
  const distanceFromBottom = overflow - element.scrollTop
  return {
    nearTop: element.scrollTop < thresholdPx,
    nearBottom: distanceFromBottom < thresholdPx,
    canScroll: true
  }
}

export function isRecallShellNearBottom(
  element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  thresholdPx = RECALL_SHELL_STICK_EDGE_THRESHOLD_PX
): boolean {
  return readRecallShellScrollState(element, thresholdPx).nearBottom
}

export function isRecallShellNearTop(
  element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  thresholdPx = RECALL_SHELL_STICK_EDGE_THRESHOLD_PX
): boolean {
  return readRecallShellScrollState(element, thresholdPx).nearTop
}

/** 单一跳转钮朝向：未贴底优先 ↓；仅贴底时 ↑。 */
export type RecallShellScrollJumpDirection = 'up' | 'down'

export function resolveRecallShellScrollJumpDirection(
  state: RecallShellScrollState
): RecallShellScrollJumpDirection | null {
  if (!state.canScroll) {
    return null
  }
  if (!state.nearBottom) {
    return 'down'
  }
  if (!state.nearTop) {
    return 'up'
  }
  return null
}

/** 将 scroll 事件合并到每帧最多一次，减轻快速滚动时的布局读取。 */
export function createRecallShellScrollListener(
  onScrollStateChange: (state: RecallShellScrollState) => void,
  thresholdPx = RECALL_SHELL_STICK_EDGE_THRESHOLD_PX
): (event: Event) => void {
  let pending = false
  let latestElement: HTMLElement | null = null

  return (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    latestElement = target
    if (pending) {
      return
    }
    pending = true
    requestAnimationFrame(() => {
      if (latestElement) {
        onScrollStateChange(readRecallShellScrollState(latestElement, thresholdPx))
      }
      pending = false
    })
  }
}

/** 下一帧滚到底（仅当仍应黏底时执行）。 */
export function scheduleRecallShellScrollToBottom(
  getScrollElement: () => HTMLElement | null,
  shouldStickToBottom: () => boolean
): void {
  requestAnimationFrame(() => {
    if (!shouldStickToBottom()) {
      return
    }
    const element = getScrollElement()
    if (!element) {
      return
    }
    element.scrollTop = element.scrollHeight
  })
}

/** 一键置顶（由 CSS `scroll-behavior` 决定是否平滑）。 */
export function scrollRecallShellToTop(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  element.scrollTop = 0
}

/** 一键到底；调用方通常同时打开黏底跟随。 */
export function scrollRecallShellToBottom(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  element.scrollTop = element.scrollHeight
}

/**
 * 将子元素对齐到滚动容器可视区顶部（仅改 scrollElement.scrollTop；不调 window.scrollIntoView）。
 * 先卡后 Framing 后，盲黏底会把首卡顶出视口——结果落地应滚到邻域锚点。
 */
export function scrollRecallShellChildToStart(
  scrollElement: HTMLElement | null,
  child: HTMLElement | null,
  offsetTopPx = 8
): void {
  if (!scrollElement || !child) {
    return
  }
  const scrollRect = scrollElement.getBoundingClientRect()
  const childRect = child.getBoundingClientRect()
  const delta = childRect.top - scrollRect.top - offsetTopPx
  const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
  const next = Math.min(maxScroll, Math.max(0, scrollElement.scrollTop + delta))
  scrollElement.scrollTop = next
}

/**
 * 对齐子元素到容器顶；子节点可能尚未挂载时最多再试 `maxAttempts` 帧。
 * 仅当 shouldRun 仍为真时执行。
 */
export function scheduleRecallShellScrollChildToStart(
  getScrollElement: () => HTMLElement | null,
  getChild: () => HTMLElement | null,
  shouldRun: () => boolean,
  offsetTopPx = 8,
  maxAttempts = 4
): void {
  const attempt = (remaining: number): void => {
    requestAnimationFrame(() => {
      if (!shouldRun()) {
        return
      }
      const scrollElement = getScrollElement()
      const child = getChild()
      if (!scrollElement || !child) {
        if (remaining > 1) {
          attempt(remaining - 1)
        }
        return
      }
      scrollRecallShellChildToStart(scrollElement, child, offsetTopPx)
    })
  }
  attempt(Math.max(1, maxAttempts))
}
