import {
  isSelectionToolbarStatusLocked,
  shouldDismissToolbarOnScroll,
  type SelectionToolbarUiMode
} from '@/content/selection-toolbar/selection-toolbar-guards'

/** 滚动收起：rAF 合并，附注模式与状态锁定时不收起。 */
export function createSelectionToolbarScrollDismissHandler(input: {
  getUiMode: () => SelectionToolbarUiMode
  getButtonState: () => Parameters<typeof isSelectionToolbarStatusLocked>[0]
  onDismiss: () => void
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
      if (
        shouldDismissToolbarOnScroll({
          statusLocked,
          uiMode: input.getUiMode()
        })
      ) {
        input.onDismiss()
      }
    })
  }

  return { onScroll, cancel }
}
