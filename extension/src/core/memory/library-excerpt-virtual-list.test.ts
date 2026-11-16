import { describe, expect, it } from 'vitest'

import {
  BOOKMARK_LIBRARY_ROW_GAP_PX,
  BOOKMARK_LIBRARY_ROW_HEIGHT,
  BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE
} from '@/core/memory/bookmark-library-index'
import {
  buildExcerptLibraryRowMetrics,
  getExcerptLibraryRowStride
} from '@/core/memory/library-excerpt-virtual-list'
import { resolveBookmarkLibraryVisibleSlice } from '@/core/memory/bookmark-library-virtual-list'

/** 与 library-item-card-content.css / AppLibraryItemCard 排版对齐的内容高上限（px） */
function clampCeilingContentHeight(hasNote: boolean): number {
  const cardChrome = 26 // padding 24 + border 2
  const titleOrExcerptLine = 15 * 1.35
  const noteLine = 13 * 1.45
  const footer = 18
  const gap = BOOKMARK_LIBRARY_ROW_GAP_PX
  const firstRowMin = 40 // AppIconButton 40×40 覆盖层
  const excerptBlock = Math.max(titleOrExcerptLine * 2, firstRowMin)
  if (!hasNote) {
    return cardChrome + excerptBlock + gap + footer
  }
  return cardChrome + excerptBlock + gap + noteLine * 2 + gap + footer
}

describe('library-excerpt-virtual-list', () => {
  it('无附注与有附注 stride 不同', () => {
    expect(getExcerptLibraryRowStride(false)).toBeLessThan(getExcerptLibraryRowStride(true))
  })

  it('混合附注行可切片渲染窗口', () => {
    const flags = Array.from({ length: 40 }, (_, index) => index % 3 === 0)
    const metrics = buildExcerptLibraryRowMetrics(flags)
    const slice = resolveBookmarkLibraryVisibleSlice(metrics, flags.length, 200, 480, 4)
    expect(slice.end - slice.start).toBeLessThan(flags.length)
    expect(slice.end - slice.start).toBeGreaterThan(0)
  })

  it('行高定额 ≥ clamp 上限内容高', () => {
    expect(BOOKMARK_LIBRARY_ROW_HEIGHT).toBeGreaterThanOrEqual(
      Math.ceil(clampCeilingContentHeight(false))
    )
    expect(BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE).toBeGreaterThanOrEqual(
      Math.ceil(clampCeilingContentHeight(true))
    )
    expect(getExcerptLibraryRowStride(false)).toBe(
      BOOKMARK_LIBRARY_ROW_HEIGHT + BOOKMARK_LIBRARY_ROW_GAP_PX
    )
    expect(getExcerptLibraryRowStride(true)).toBe(
      BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE + BOOKMARK_LIBRARY_ROW_GAP_PX
    )
  })
})
