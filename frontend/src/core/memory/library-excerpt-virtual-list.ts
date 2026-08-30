import {
  BOOKMARK_LIBRARY_ROW_GAP_PX,
  BOOKMARK_LIBRARY_ROW_HEIGHT,
  BOOKMARK_LIBRARY_ROW_HEIGHT_WITH_NOTE
} from '@/core/memory/bookmark-library-index'
import {
  buildStrideRowMetrics,
  type BookmarkLibraryRowMetrics
} from '@/core/memory/bookmark-library-virtual-list'

/** 摘录卡片虚拟行 stride（与 AppLibraryItemCard + line-clamp 对齐）。 */
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
