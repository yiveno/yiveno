import type { BookmarkLibraryVisibleRow } from '@/core/memory/bookmark-library-index'

/** 书签树行 v-memo 上下文（父组件状态，非行内字段）。 */
export type BookmarkLibraryRowMemoContext = {
  showDetailExportSelection: boolean
  detailExportSelectionRevision: number
  exportSelected: boolean
  deletingId: string | null
  showUnsyncedFlags: boolean
}

/**
 * 书签树行 v-memo 依赖（14 项）。
 * 缺项会导致展开/附注/标题等变更时行跳过更新。
 */
export function buildBookmarkLibraryRowMemoDeps(
  row: BookmarkLibraryVisibleRow,
  ctx: BookmarkLibraryRowMemoContext
): unknown[] {
  return [
    row.kind,
    row.chromeId,
    row.depth,
    row.title,
    row.url ?? '',
    row.note ?? '',
    row.savedAt ?? '',
    row.expanded ?? false,
    row.kind === 'bookmark' && !row.memoryItemId,
    ctx.showDetailExportSelection,
    ctx.detailExportSelectionRevision,
    ctx.exportSelected,
    ctx.deletingId === row.memoryItemId,
    ctx.showUnsyncedFlags
  ]
}
