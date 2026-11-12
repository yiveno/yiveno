import { describe, expect, it } from 'vitest'

import {
  isSelectionToolbarStatusLocked,
  shouldDismissToolbarOnScroll,
  shouldRepositionToolbarOnScroll
} from '@/content/selection-toolbar/selection-toolbar-guards'

describe('selection-toolbar-guards', () => {
  it('isSelectionToolbarStatusLocked 覆盖 saving/saved/error', () => {
    expect(isSelectionToolbarStatusLocked('idle')).toBe(false)
    expect(isSelectionToolbarStatusLocked('saving')).toBe(true)
    expect(isSelectionToolbarStatusLocked('saved')).toBe(true)
    expect(isSelectionToolbarStatusLocked('error')).toBe(true)
  })

  it('shouldDismissToolbarOnScroll 附注模式不收起', () => {
    expect(
      shouldDismissToolbarOnScroll({
        statusLocked: false,
        uiMode: 'note'
      })
    ).toBe(false)
  })

  it('shouldDismissToolbarOnScroll 状态锁定时不收起', () => {
    expect(
      shouldDismissToolbarOnScroll({
        statusLocked: true,
        uiMode: 'actions'
      })
    ).toBe(false)
  })

  it('shouldDismissToolbarOnScroll 默认操作态应收起', () => {
    expect(
      shouldDismissToolbarOnScroll({
        statusLocked: false,
        uiMode: 'actions'
      })
    ).toBe(true)
  })

  it('shouldRepositionToolbarOnScroll 附注模式应跟随、锁定时不跟随', () => {
    expect(
      shouldRepositionToolbarOnScroll({
        statusLocked: false,
        uiMode: 'note'
      })
    ).toBe(true)
    expect(
      shouldRepositionToolbarOnScroll({
        statusLocked: true,
        uiMode: 'note'
      })
    ).toBe(false)
    expect(
      shouldRepositionToolbarOnScroll({
        statusLocked: false,
        uiMode: 'actions'
      })
    ).toBe(false)
  })
})
