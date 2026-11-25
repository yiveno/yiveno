/**
 * 结果卡悬停预览：延迟显示 / 离开取消；纯逻辑便于单测。
 * 不触发任何网络或标签导航。
 */

/** 悬停多久后出浮层（避免划过闪烁）。 */
export const RECALL_CARD_PREVIEW_HOVER_DELAY_MS = 250

/** 浮层目标宽（与截图 320px 对齐）。 */
export const RECALL_CARD_PREVIEW_WIDTH_PX = 320

export type HoverPreviewPlacement = {
  top: number
  left: number
  width: number
  maxHeight: number
}

/**
 * 将 320px 浮层摆进 panel 内：优先卡下方，不够则上方；水平夹紧。
 * 坐标相对 viewport（position: fixed）。
 */
export function placeHoverPreviewInPanel(input: {
  anchor: DOMRect
  panel: DOMRect
  previewWidth?: number
  previewHeightEstimate?: number
  gap?: number
}): HoverPreviewPlacement {
  const width = Math.min(
    input.previewWidth ?? RECALL_CARD_PREVIEW_WIDTH_PX,
    Math.max(120, input.panel.width - 16)
  )
  const gap = input.gap ?? 8
  const estimate = input.previewHeightEstimate ?? 280
  const spaceBelow = input.panel.bottom - input.anchor.bottom - gap
  const spaceAbove = input.anchor.top - input.panel.top - gap
  const preferBelow = spaceBelow >= Math.min(estimate, 160) || spaceBelow >= spaceAbove
  let top: number
  let maxHeight: number
  if (preferBelow) {
    top = input.anchor.bottom + gap
    maxHeight = Math.max(120, input.panel.bottom - top - 8)
  } else {
    maxHeight = Math.max(120, Math.min(estimate, spaceAbove))
    top = input.anchor.top - gap - Math.min(estimate, maxHeight)
    if (top < input.panel.top + 8) {
      top = input.panel.top + 8
      maxHeight = Math.max(120, input.anchor.top - gap - top)
    }
  }

  let left = input.anchor.left
  const maxLeft = input.panel.right - width - 8
  const minLeft = input.panel.left + 8
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft))

  return { top, left, width, maxHeight }
}

/**
 * 悬停预览锚定的会话滚动根（`.recall-body`）。
 * 浮层 `position: fixed` 不跟列表滚；会话区一滚就必须收起，否则盖住内容。
 */
export function resolveRecallHoverPreviewScrollRoot(from: Element | null): HTMLElement | null {
  if (!from) {
    return null
  }
  return from.closest('.recall-body')
}

/**
 * 会话区滚动 → 收起悬停预览（含延迟未出层时取消）。
 * 不锁滚动：预览是 ephemeral 悬停层，不是模态。
 */
export function bindHoverPreviewScrollDismiss(
  scrollRoot: EventTarget | null,
  onDismiss: () => void
): () => void {
  if (!scrollRoot) {
    return () => {}
  }
  const handler = (): void => {
    onDismiss()
  }
  scrollRoot.addEventListener('scroll', handler, { passive: true })
  return () => {
    scrollRoot.removeEventListener('scroll', handler)
  }
}

/**
 * 滚动停稳后多久再尝试重出预览。
 * 连续滚动会重置；避免停一下又滚时闪层。
 */
export const RECALL_CARD_PREVIEW_SCROLL_REARM_MS = 160

/**
 * 会话区滚动时浏览器偶发 pointerleave，但坐标仍落在卡组内。
 * 此时应忽略 leave，保留 pointerInside 与停稳重武装。
 */
export function shouldIgnoreHoverPreviewPointerLeave(input: {
  group: Element | null
  clientX: number
  clientY: number
  elementFromPoint?: (x: number, y: number) => Element | null
}): boolean {
  if (!input.group) {
    return false
  }
  const hit =
    input.elementFromPoint?.(input.clientX, input.clientY) ??
    (typeof document !== 'undefined'
      ? document.elementFromPoint(input.clientX, input.clientY)
      : null)
  return Boolean(hit && input.group.contains(hit))
}

/**
 * 滚动收起后的「停稳重武装」：指针仍在卡上时，settle 后再走一遍延迟出层。
 * 真正离开由调用方 cancel，不再重武装。
 */
export function createHoverPreviewScrollRearm(options?: {
  settleMs?: number
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  cancel?: (id: ReturnType<typeof setTimeout>) => void
}) {
  const settleMs = options?.settleMs ?? RECALL_CARD_PREVIEW_SCROLL_REARM_MS
  const schedule = options?.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const cancelTimer = options?.cancel ?? ((id: ReturnType<typeof setTimeout>) => clearTimeout(id))

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) {
      cancelTimer(timer)
      timer = null
    }
  }

  return {
    /**
     * 每次 scroll 调用：清旧计时；settleMs 无新 scroll 后，
     * 若 shouldRearm() 为真则 onRearm（通常再走 hover delay）。
     */
    noteScroll(shouldRearm: () => boolean, onRearm: () => void): void {
      clearTimer()
      timer = schedule(() => {
        timer = null
        if (shouldRearm()) {
          onRearm()
        }
      }, settleMs)
    },
    /** 指针离开 / 卸载：取消待重武装。 */
    cancel(): void {
      clearTimer()
    }
  }
}

/** 延迟悬停控制器（同一时间只服务一张卡）。 */
export function createHoverPreviewDelayController(options?: {
  delayMs?: number
  now?: () => number
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  cancel?: (id: ReturnType<typeof setTimeout>) => void
}) {
  const delayMs = options?.delayMs ?? RECALL_CARD_PREVIEW_HOVER_DELAY_MS
  const schedule = options?.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const cancel = options?.cancel ?? ((id: ReturnType<typeof setTimeout>) => clearTimeout(id))

  let timer: ReturnType<typeof setTimeout> | null = null
  let activeCardId: string | null = null

  function clearTimer(): void {
    if (timer !== null) {
      cancel(timer)
      timer = null
    }
  }

  return {
    /** 指针进入：delay 后回调 onShow；换卡会取消上一计时。 */
    enter(cardId: string, onShow: () => void): void {
      if (activeCardId === cardId && timer === null) {
        // 已显示同一张：保持
        return
      }
      clearTimer()
      activeCardId = cardId
      timer = schedule(() => {
        timer = null
        onShow()
      }, delayMs)
    },
    /** 指针离开：取消待显示；若已显示由调用方关浮层。 */
    leave(cardId: string): void {
      if (activeCardId !== cardId) {
        return
      }
      clearTimer()
      activeCardId = null
    },
    /** 强制取消（滚动 / 卸载）。 */
    cancelAll(): void {
      clearTimer()
      activeCardId = null
    },
    getActiveCardId(): string | null {
      return activeCardId
    }
  }
}
