import { describe, expect, it } from 'vitest'

import {
  computeSelectionToolbarAnchor,
  resolveSelectionAnchorRect,
  shouldHideToolbarOnEmptySelection,
  shouldShowSelectionToolbar
} from '@/content/selection-toolbar/selection-toolbar-logic'

describe('selection-toolbar-logic', () => {
  it('computeSelectionToolbarAnchor 优先显示在选区上方', () => {
    expect(computeSelectionToolbarAnchor({ top: 80, left: 100, width: 120, height: 20 })).toEqual({
      top: 36,
      left: 160
    })
  })

  it('computeSelectionToolbarAnchor 空间不足时改到选区下方', () => {
    expect(computeSelectionToolbarAnchor({ top: 10, left: 100, width: 120, height: 20 })).toEqual({
      top: 38,
      left: 160
    })
  })

  it('shouldShowSelectionToolbar 受开关与选区影响', () => {
    expect(
      shouldShowSelectionToolbar({
        enabled: true,
        selectedText: 'retention',
        isSavablePage: true
      })
    ).toBe(true)

    expect(
      shouldShowSelectionToolbar({
        enabled: false,
        selectedText: 'retention',
        isSavablePage: true
      })
    ).toBe(false)

    expect(
      shouldShowSelectionToolbar({
        enabled: true,
        selectedText: '   ',
        isSavablePage: true
      })
    ).toBe(false)

    expect(
      shouldShowSelectionToolbar({
        enabled: true,
        selectedText: '不用记标题，只要描述你记得的东西',
        isSavablePage: true
      })
    ).toBe(true)
  })

  it('resolveSelectionAnchorRect 在 bounding rect 为 0 时合并 clientRects', () => {
    const merged = resolveSelectionAnchorRect({
      getBoundingClientRect: () => new DOMRect(10, 20, 0, 0),
      getClientRects: () => [new DOMRect(10, 20, 16, 18), new DOMRect(10, 38, 16, 18)]
    })

    expect(merged).toEqual({
      top: 20,
      left: 10,
      width: 16,
      height: 36
    })
  })

  it('resolveSelectionAnchorRect 在无有效矩形时返回 null', () => {
    expect(
      resolveSelectionAnchorRect({
        getBoundingClientRect: () => new DOMRect(0, 0, 0, 0),
        getClientRects: () => []
      })
    ).toBeNull()
  })

  it('shouldHideToolbarOnEmptySelection 保护 delay 与快照撑起的浮层', () => {
    expect(
      shouldHideToolbarOnEmptySelection({
        showTimerPending: true,
        hasPendingCapture: true,
        toolbarVisible: false
      })
    ).toBe(false)

    expect(
      shouldHideToolbarOnEmptySelection({
        showTimerPending: false,
        hasPendingCapture: true,
        toolbarVisible: true
      })
    ).toBe(false)

    expect(
      shouldHideToolbarOnEmptySelection({
        showTimerPending: false,
        hasPendingCapture: false,
        toolbarVisible: false
      })
    ).toBe(true)

    expect(
      shouldHideToolbarOnEmptySelection({
        showTimerPending: false,
        hasPendingCapture: true,
        toolbarVisible: false
      })
    ).toBe(true)
  })
})
