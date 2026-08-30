import { resolveMemoryItemSavedAtIso } from '@/core/memory/memory-item-saved-at'
import type { MemoryItem } from '@/core/memory/memory-item'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { formatLibrarySavedAt } from '@/infrastructure/i18n/format-library-saved-at'
import { t } from '@/infrastructure/i18n/t'

/** 摘录列表虚拟行（展示字段在加载时预计算，避免滚动/多选时重复 format）。 */
export interface ExcerptLibraryListRow {
  id: string
  title: string
  subtitle: string
  excerpt: string | null
  note: string | null
  href: string
  savedAt: string
  savedAtLabel: string
  sourceUrl?: string
}

/** 从 MemoryItem 构建摘录列表行视图。 */
export function buildExcerptLibraryListRows(items: readonly MemoryItem[]): ExcerptLibraryListRow[] {
  const detailPageUrl = chrome.runtime.getURL('detail.html')
  return items.map(item => {
    const display = getMemoryItemDisplay(item, t)
    const savedAt = resolveMemoryItemSavedAtIso(item)
    return {
      id: item.id,
      title: display.title,
      subtitle: display.subtitle,
      excerpt: display.excerpt ?? null,
      note: item.clues.note?.trim() || null,
      href: getMemoryItemOpenHref(item, { detailPageUrl }),
      savedAt,
      savedAtLabel: formatLibrarySavedAt(savedAt),
      ...(item.type === 'text_excerpt' ? { sourceUrl: item.payload.sourceUrl } : {})
    }
  })
}

/** 书签索引中可 detail export 的 memoryItemId 列表（加载时算一次）。 */
export function collectBookmarkExportableMemoryIds(
  nodes: ReadonlyArray<{ kind: string; memoryItemId?: string }>
): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.kind === 'bookmark' && node.memoryItemId) {
      ids.push(node.memoryItemId)
    }
  }
  return ids
}
