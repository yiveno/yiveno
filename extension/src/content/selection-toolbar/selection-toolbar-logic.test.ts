import { describe, expect, it } from 'vitest'

import {
  computeSelectionToolbarAnchor,
  matchNoteDraft,
  resolveScrolledSelectionAnchor,
  resolveSelectionAnchorRect,
  shouldEvaluateSelectionOnChange,
  shouldHideToolbarOnEmptySelection,
  shouldShowSelectionToolbar,
  shouldStashNoteDraft
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

  it('shouldStashNoteDraft 仅非空 trim 应保留', () => {
    expect(shouldStashNoteDraft('')).toBe(false)
    expect(shouldStashNoteDraft('   ')).toBe(false)
    expect(shouldStashNoteDraft('later')).toBe(true)
  })

  it('matchNoteDraft 仅同一选区命中', () => {
    const draft = { selectedText: 'same span', note: 'draft note' }
    expect(matchNoteDraft(draft, 'same span')).toBe('draft note')
    expect(matchNoteDraft(draft, 'other span')).toBeNull()
    expect(matchNoteDraft(null, 'same span')).toBeNull()
  })

  it('shouldEvaluateSelectionOnChange 键盘选区应评估', () => {
    expect(
      shouldEvaluateSelectionOnChange({
        mouseDown: false,
        msSinceSelectionKeyDown: 200,
        enabled: true,
        selectedText: 'hello',
        isSavablePage: true
      })
    ).toBe(true)
  })

  it('shouldEvaluateSelectionOnChange mouseDown 或无近期选区键时不评估', () => {
    expect(
      shouldEvaluateSelectionOnChange({
        mouseDown: true,
        msSinceSelectionKeyDown: 100,
        enabled: true,
        selectedText: 'hello',
        isSavablePage: true
      })
    ).toBe(false)
    expect(
      shouldEvaluateSelectionOnChange({
        mouseDown: false,
        msSinceSelectionKeyDown: null,
        enabled: true,
        selectedText: 'hello',
        isSavablePage: true
      })
    ).toBe(false)
    expect(
      shouldEvaluateSelectionOnChange({
        mouseDown: false,
        msSinceSelectionKeyDown: 1500,
        enabled: true,
        selectedText: 'hello',
        isSavablePage: true
      })
    ).toBe(false)
  })

  it('computeSelectionToolbarAnchor 右沿钳制：中心点按实测宽度左移', () => {
    expect(
      computeSelectionToolbarAnchor(
        { top: 100, left: 900, width: 100, height: 20 },
        { estimatedHeight: 36, viewportWidth: 1000, toolbarWidth: 280 }
      )
    ).toEqual({ top: 56, left: 852 })
  })

  it('computeSelectionToolbarAnchor 窄视口居中', () => {
    expect(
      computeSelectionToolbarAnchor(
        { top: 80, left: 100, width: 120, height: 20 },
        { estimatedHeight: 36, viewportWidth: 300, toolbarWidth: 320 }
      )
    ).toEqual({ top: 36, left: 150 })
  })

  it('computeSelectionToolbarAnchor 底部放不下时改放上方/贴底', () => {
    // above 够 → 放上方
    expect(
      computeSelectionToolbarAnchor(
        { top: 200, left: 100, width: 120, height: 20 },
        {
          estimatedHeight: 120,
          viewportWidth: 800,
          viewportHeight: 400,
          toolbarWidth: 220
        }
      )
    ).toEqual({ top: 72, left: 160 })

    // above/below 都不够 → 贴底
    expect(
      computeSelectionToolbarAnchor(
        { top: 40, left: 100, width: 120, height: 20 },
        {
          estimatedHeight: 120,
          viewportWidth: 800,
          viewportHeight: 150,
          toolbarWidth: 220
        }
      )
    ).toEqual({ top: 22, left: 160 })
  })

  it('resolveScrolledSelectionAnchor 滚动量换算；出视口返回 null', () => {
    expect(
      resolveScrolledSelectionAnchor({
        snapshotRect: { top: 100, left: 50, width: 80, height: 20 },
        snapshotScroll: { x: 0, y: 200 },
        currentScroll: { x: 0, y: 260 },
        viewportWidth: 800,
        viewportHeight: 600
      })
    ).toEqual({ top: 40, left: 50, width: 80, height: 20 })

    expect(
      resolveScrolledSelectionAnchor({
        snapshotRect: { top: 100, left: 50, width: 80, height: 20 },
        snapshotScroll: { x: 0, y: 0 },
        currentScroll: { x: 0, y: 800 },
        viewportWidth: 800,
        viewportHeight: 600
      })
    ).toBeNull()
  })
})
