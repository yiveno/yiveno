import { z } from 'zod'

import type { MemoryItem } from '@/core/memory/memory-item'

/**
 * 当前可写入的 MemoryItem 类型（MVP）。预留未写入：image / video / note / file。
 * - bookmark：书签
 * - text_excerpt：文本摘录
 */
export const SupportedMemoryItemTypeSchema = z.enum([
  'bookmark', // 书签
  'text_excerpt' // 文本摘录
])

export type SupportedMemoryItemType = z.infer<typeof SupportedMemoryItemTypeSchema>

/**
 * 云同步类型范围（ADR-017）：仅摘录上云 / 拉回。
 * 书签 Memory 本机灌库，不参与云并集。
 * （原 cloud-syncable-memory-item.ts 机械并入）
 */

/** 是否属于云同步工作集（仅 `text_excerpt`）。 */
export function isCloudSyncableMemoryItem(item: MemoryItem): boolean {
  return item.type === 'text_excerpt'
}

/** 过滤出可上云 / 可从云应用的条目。 */
export function filterCloudSyncableMemoryItems(items: readonly MemoryItem[]): MemoryItem[] {
  return items.filter(isCloudSyncableMemoryItem)
}
