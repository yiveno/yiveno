import {
  BOOKMARK_LIBRARY_ROW_GAP_PX,
  BOOKMARK_LIBRARY_ROW_HEIGHT,
  BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE
} from '@/core/memory/bookmark-library-index'
import {
  buildStrideRowMetrics,
  type BookmarkLibraryRowMetrics
} from '@/core/memory/bookmark-library-virtual-list'

/**
 * 摘录卡片虚拟行 stride。
 * 行高常量与 `library-item-card-content.css` 的 line-clamp 上限对应：
 * - 无附注：BOOKMARK_LIBRARY_ROW_HEIGHT（93）= 26 + max(2×摘录行, 40) + 8 + 18
 * - 有附注：BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE（139）= 26 + 2×摘录 + 8 + 2×附注 + 8 + 18
 * stride = 内容高 + BOOKMARK_LIBRARY_ROW_GAP_PX（8）。
 */
export function getExcerptLibraryRowStride(hasNote: boolean): number {
  const contentHeight = hasNote
    ? BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE
    : BOOKMARK_LIBRARY_ROW_HEIGHT
  return contentHeight + BOOKMARK_LIBRARY_ROW_GAP_PX
}

/** 摘录列表行 metrics（按是否有附注估 stride）。 */
export function buildExcerptLibraryRowMetrics(
  hasNoteFlags: readonly boolean[]
): BookmarkLibraryRowMetrics {
  return buildStrideRowMetrics(hasNoteFlags.length, index =>
    getExcerptLibraryRowStride(hasNoteFlags[index] ?? false)
  )
}
