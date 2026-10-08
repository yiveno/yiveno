import { describe, expect, it, vi } from 'vitest'

import { createSelectionToolbarScrollDismissHandler } from '@/content/selection-toolbar/selection-toolbar-scroll'

describe('createSelectionToolbarScrollDismissHandler', () => {
  it('操作态滚动时合并为单次 dismiss', () => {
    const onDismiss = vi.fn()
    const held: FrameRequestCallback[] = []
    const { onScroll } = createSelectionToolbarScrollDismissHandler({
      getUiMode: () => 'actions',
      getButtonState: () => 'idle',
      onDismiss,
      requestAnimationFrame: cb => {
        held.push(cb)
        return 1
      },
      cancelAnimationFrame: () => {}
    })

    onScroll()
    onScroll()
    expect(onDismiss).not.toHaveBeenCalled()
    held[0]!(0)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('附注模式不收起', () => {
    const onDismiss = vi.fn()
    const held: FrameRequestCallback[] = []
    const { onScroll } = createSelectionToolbarScrollDismissHandler({
      getUiMode: () => 'note',
      getButtonState: () => 'idle',
      onDismiss,
      requestAnimationFrame: cb => {
        held.push(cb)
        return 1
      },
      cancelAnimationFrame: () => {}
    })

    onScroll()
    held[0]!(0)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('cancel 取消待执行的 rAF', () => {
    const onDismiss = vi.fn()
    const held: FrameRequestCallback[] = []
    const cancelRaf = vi.fn()
    const { onScroll, cancel } = createSelectionToolbarScrollDismissHandler({
      getUiMode: () => 'actions',
      getButtonState: () => 'idle',
      onDismiss,
      requestAnimationFrame: cb => {
        held.push(cb)
        return 42
      },
      cancelAnimationFrame: cancelRaf
    })

    onScroll()
    cancel()
    expect(cancelRaf).toHaveBeenCalledWith(42)
    held[0]!(0)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
