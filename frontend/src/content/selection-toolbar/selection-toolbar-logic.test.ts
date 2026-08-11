import { describe, expect, it } from 'vitest'

import {
  computeSelectionToolbarAnchor,
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
  })
})
