/**
 * 结果卡悬停预览：延迟显示 / 离开取消；纯逻辑便于单测。
 * 不触发任何网络或标签导航。
 */

/** 悬停多久后出浮层（避免划过闪烁）。 */
export const RECALL_CARD_PREVIEW_HOVER_DELAY_MS = 250

/** 浮层目标宽（与截图 320px 对齐）。 */
export const RECALL_CARD_PREVIEW_WIDTH_PX = 320

export type HoverPreviewShowRequest = {
  cardId: string
  anchor: DOMRect
  panel: DOMRect
}

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
