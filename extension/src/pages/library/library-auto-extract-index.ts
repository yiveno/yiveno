/**
 * Library / Detail「已提炼」徽标：按 URL 键索引 auto_extract 摘录。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { normalizePagePreviewUrlKey } from '@/infrastructure/indexeddb/page-preview-types'

export type AutoExtractIndexEntry = {
  id: string
  href: string
}

/** 从条目列表建成 urlKey → auto_extract 详情入口；非 auto_extract 忽略。 */
export function buildAutoExtractUrlIndex(
  items: readonly MemoryItem[],
  detailPageUrl: string
): Map<string, AutoExtractIndexEntry> {
  const map = new Map<string, AutoExtractIndexEntry>()
  for (const item of items) {
    if (item.type !== 'text_excerpt' || item.deletedAt != null) {
      continue
    }
    if (item.payload.origin !== 'auto_extract') {
      continue
    }
    const urlKey = normalizePagePreviewUrlKey(item.payload.sourceUrl)
    if (!urlKey) {
      continue
    }
    const href = new URL(detailPageUrl)
    href.searchParams.set('id', item.id)
    map.set(urlKey, { id: item.id, href: href.href })
  }
  return map
}

/** 解析页面/书签 URL 对应的提炼详情；无则 null。 */
export function resolveAutoExtractEntryForUrl(
  index: ReadonlyMap<string, AutoExtractIndexEntry>,
  pageUrl: string | null | undefined
): AutoExtractIndexEntry | null {
  if (!pageUrl) {
    return null
  }
  const urlKey = normalizePagePreviewUrlKey(pageUrl)
  if (!urlKey) {
    return null
  }
  return index.get(urlKey) ?? null
}
