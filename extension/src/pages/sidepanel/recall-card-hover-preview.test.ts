import { describe, expect, it, vi } from 'vitest'

import {
  bindHoverPreviewScrollDismiss,
  createHoverPreviewDelayController,
  createHoverPreviewScrollRearm,
  placeHoverPreviewInPanel,
  resolveRecallHoverPreviewScrollRoot,
  shouldIgnoreHoverPreviewPointerLeave,
  RECALL_CARD_PREVIEW_HOVER_DELAY_MS,
  RECALL_CARD_PREVIEW_SCROLL_REARM_MS,
  RECALL_CARD_PREVIEW_WIDTH_PX
} from '@/pages/sidepanel/recall-card-hover-preview'

describe('placeHoverPreviewInPanel', () => {
  it('窄 panel 内夹紧宽度与水平位置', () => {
    const panel = new DOMRect(0, 0, 360, 800)
    const anchor = new DOMRect(20, 100, 320, 80)
    const placed = placeHoverPreviewInPanel({
      anchor,
      panel,
      previewWidth: RECALL_CARD_PREVIEW_WIDTH_PX,
      previewHeightEstimate: 200
    })
    expect(placed.width).toBeLessThanOrEqual(panel.width - 16)
    expect(placed.left).toBeGreaterThanOrEqual(panel.left + 8)
    expect(placed.left + placed.width).toBeLessThanOrEqual(panel.right - 8 + 0.5)
    expect(placed.top).toBeGreaterThanOrEqual(panel.top)
  })
})

describe('createHoverPreviewDelayController', () => {
  it('延迟后才 onShow；leave 取消待显示', () => {
    vi.useFakeTimers()
    const scheduled: Array<{ fn: () => void; ms: number }> = []
    const controller = createHoverPreviewDelayController({
      delayMs: RECALL_CARD_PREVIEW_HOVER_DELAY_MS,
      schedule: (fn, ms) => {
        scheduled.push({ fn, ms })
        return setTimeout(fn, ms)
      },
      cancel: id => clearTimeout(id)
    })

    const onShow = vi.fn()
    controller.enter('card-1', onShow)
    expect(onShow).not.toHaveBeenCalled()
    expect(scheduled[0]?.ms).toBe(RECALL_CARD_PREVIEW_HOVER_DELAY_MS)

    controller.leave('card-1')
    vi.advanceTimersByTime(RECALL_CARD_PREVIEW_HOVER_DELAY_MS + 10)
    expect(onShow).not.toHaveBeenCalled()

    controller.enter('card-1', onShow)
    vi.advanceTimersByTime(RECALL_CARD_PREVIEW_HOVER_DELAY_MS)
    expect(onShow).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('换卡取消上一计时', () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const second = vi.fn()
    const controller = createHoverPreviewDelayController({
      delayMs: 250
    })
    controller.enter('a', first)
    controller.enter('b', second)
    vi.advanceTimersByTime(250)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('cancelAll 取消待显示（会话区滚动收起路径）', () => {
    vi.useFakeTimers()
    const onShow = vi.fn()
    const controller = createHoverPreviewDelayController({ delayMs: 250 })
    controller.enter('card-1', onShow)
    controller.cancelAll()
    vi.advanceTimersByTime(300)
    expect(onShow).not.toHaveBeenCalled()
    expect(controller.getActiveCardId()).toBeNull()
    vi.useRealTimers()
  })
})

describe('resolveRecallHoverPreviewScrollRoot / bindHoverPreviewScrollDismiss', () => {
  it('从卡节点上溯到 .recall-body', () => {
    const root = document.createElement('div')
    root.className = 'recall-body'
    const card = document.createElement('div')
    root.appendChild(card)
    expect(resolveRecallHoverPreviewScrollRoot(card)).toBe(root)
    expect(resolveRecallHoverPreviewScrollRoot(null)).toBeNull()
  })

  it('scroll 回调 onDismiss；解绑后不再触发', () => {
    const root = document.createElement('div')
    const onDismiss = vi.fn()
    const stop = bindHoverPreviewScrollDismiss(root, onDismiss)
    root.dispatchEvent(new Event('scroll'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    stop()
    root.dispatchEvent(new Event('scroll'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('scrollRoot 为空时解绑为空操作', () => {
    expect(() => bindHoverPreviewScrollDismiss(null, () => {})()).not.toThrow()
  })
})

describe('shouldIgnoreHoverPreviewPointerLeave', () => {
  it('坐标仍落在卡组内则忽略 leave', () => {
    const group = document.createElement('div')
    const child = document.createElement('span')
    group.appendChild(child)
    expect(
      shouldIgnoreHoverPreviewPointerLeave({
        group,
        clientX: 10,
        clientY: 10,
        elementFromPoint: () => child
      })
    ).toBe(true)
  })

  it('坐标落到卡外则不忽略', () => {
    const group = document.createElement('div')
    const outside = document.createElement('div')
    expect(
      shouldIgnoreHoverPreviewPointerLeave({
        group,
        clientX: 10,
        clientY: 10,
        elementFromPoint: () => outside
      })
    ).toBe(false)
    expect(
      shouldIgnoreHoverPreviewPointerLeave({
        group: null,
        clientX: 0,
        clientY: 0,
        elementFromPoint: () => null
      })
    ).toBe(false)
  })
})

describe('createHoverPreviewScrollRearm', () => {
  it('停稳后 shouldRearm 为真才 onRearm；连续 scroll 重置计时', () => {
    vi.useFakeTimers()
    const rearm = createHoverPreviewScrollRearm({
      settleMs: RECALL_CARD_PREVIEW_SCROLL_REARM_MS
    })
    const onRearm = vi.fn()
    let inside = true

    rearm.noteScroll(() => inside, onRearm)
    vi.advanceTimersByTime(RECALL_CARD_PREVIEW_SCROLL_REARM_MS - 20)
    expect(onRearm).not.toHaveBeenCalled()

    rearm.noteScroll(() => inside, onRearm)
    vi.advanceTimersByTime(RECALL_CARD_PREVIEW_SCROLL_REARM_MS - 20)
    expect(onRearm).not.toHaveBeenCalled()

    vi.advanceTimersByTime(40)
    expect(onRearm).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('停稳时已离开则不重武装；cancel 取消待重武装', () => {
    vi.useFakeTimers()
    const rearm = createHoverPreviewScrollRearm({ settleMs: 160 })
    const onRearm = vi.fn()

    rearm.noteScroll(() => false, onRearm)
    vi.advanceTimersByTime(200)
    expect(onRearm).not.toHaveBeenCalled()

    rearm.noteScroll(() => true, onRearm)
    rearm.cancel()
    vi.advanceTimersByTime(200)
    expect(onRearm).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
