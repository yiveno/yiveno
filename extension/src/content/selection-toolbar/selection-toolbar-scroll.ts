import {
  isSelectionToolbarStatusLocked,
  shouldDismissToolbarOnScroll,
  shouldRepositionToolbarOnScroll,
  type SelectionToolbarUiMode
} from '@/content/selection-toolbar/selection-toolbar-guards'

/** 滚动：rAF 合并；操作态收起，附注态跟随重定位，锁定时不动。 */
export function createSelectionToolbarScrollDismissHandler(input: {
  getUiMode: () => SelectionToolbarUiMode
  getButtonState: () => Parameters<typeof isSelectionToolbarStatusLocked>[0]
  onDismiss: () => void
  /** 附注模式下滚动跟随选区（按快照锚点重定位） */
  onReposition?: () => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}): { onScroll: () => void; cancel: () => void } {
  const raf = input.requestAnimationFrame ?? globalThis.requestAnimationFrame.bind(globalThis)
  const cancelRaf = input.cancelAnimationFrame ?? globalThis.cancelAnimationFrame.bind(globalThis)
  let rafId: number | null = null
  let disposed = false

  const cancel = (): void => {
    disposed = true
    if (rafId !== null) {
      cancelRaf(rafId)
      rafId = null
    }
  }

  const onScroll = (): void => {
    if (rafId !== null) {
      return
    }
    rafId = raf(() => {
      rafId = null
      if (disposed) {
        return
      }
      const statusLocked = isSelectionToolbarStatusLocked(input.getButtonState())
      const uiMode = input.getUiMode()
      if (
        shouldDismissToolbarOnScroll({
          statusLocked,
          uiMode
        })
      ) {
        input.onDismiss()
        return
      }
      if (
        shouldRepositionToolbarOnScroll({
          statusLocked,
          uiMode
        })
      ) {
        input.onReposition?.()
      }
    })
  }

  return { onScroll, cancel }
}
