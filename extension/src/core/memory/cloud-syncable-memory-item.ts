/**
 * 云同步类型范围（ADR-017）：仅摘录上云 / 拉回。
 * 书签 Memory 本机灌库，不参与云并集。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/** 是否属于云同步工作集（仅 `text_excerpt`）。 */
export function isCloudSyncableMemoryItem(item: MemoryItem): boolean {
  return item.type === 'text_excerpt'
}

/** 过滤出可上云 / 可从云应用的条目。 */
export function filterCloudSyncableMemoryItems(items: readonly MemoryItem[]): MemoryItem[] {
  return items.filter(isCloudSyncableMemoryItem)
}
