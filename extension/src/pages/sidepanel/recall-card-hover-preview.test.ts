import { describe, expect, it, vi } from 'vitest'

import {
  createHoverPreviewDelayController,
  placeHoverPreviewInPanel,
  RECALL_CARD_PREVIEW_HOVER_DELAY_MS,
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
})
