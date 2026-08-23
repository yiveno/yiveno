import {
  getBookmarkLibraryRowHeight,
  type BookmarkLibraryVisibleRow
} from '@/core/memory/bookmark-library-index'

export interface BookmarkLibraryRowMetrics {
  offsets: number[]
  heights: number[]
  totalHeight: number
}

/** 预计算每行 offset，供虚拟滚动 O(log n) 定位。 */
export function buildBookmarkLibraryRowMetrics(
  rows: readonly BookmarkLibraryVisibleRow[]
): BookmarkLibraryRowMetrics {
  const offsets: number[] = [0]
  const heights: number[] = []
  let total = 0
  for (const row of rows) {
    const height = getBookmarkLibraryRowHeight(row)
    heights.push(height)
    total += height
    offsets.push(total)
  }
  return { offsets, heights, totalHeight: total }
}

/** 在 offsets 中查找 scrollTop 对应的首行索引。 */
export function findBookmarkLibraryRowIndexAtOffset(
  offsets: readonly number[],
  pixel: number
): number {
  if (offsets.length <= 1) {
    return 0
  }
  let low = 0
  let high = offsets.length - 2
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    if (offsets[mid] <= pixel) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return low
}

export interface BookmarkLibraryVisibleSlice {
  start: number
  end: number
  paddingTop: number
  paddingBottom: number
}

/** 根据 scrollTop + viewport 计算应渲染的行区间（含 overscan）。 */
export function resolveBookmarkLibraryVisibleSlice(
  metrics: BookmarkLibraryRowMetrics,
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 8
): BookmarkLibraryVisibleSlice {
  if (rowCount === 0) {
    return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 }
  }

  const { offsets, totalHeight } = metrics
  const start = findBookmarkLibraryRowIndexAtOffset(offsets, scrollTop)
  let end = start
  const bottom = scrollTop + viewportHeight
  while (end < rowCount && offsets[end] < bottom) {
    end += 1
  }

  const sliceStart = Math.max(0, start - overscan)
  const sliceEnd = Math.min(rowCount, end + overscan)
  const paddingTop = offsets[sliceStart] ?? 0
  const paddingBottom = Math.max(0, totalHeight - (offsets[sliceEnd] ?? totalHeight))

  return {
    start: sliceStart,
    end: sliceEnd,
    paddingTop,
    paddingBottom
  }
}
