/**
 * Side Panel Recall 来源范围：按 MemoryItem.type 硬筛。
 * 默认 all；不进 clue 字符串，也不改 objectTypes 槽位。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'

/** 召回来源范围。 */
export const RECALL_SOURCE_SCOPES = [
  'all', // 全部：书签 + 摘录
  'text_excerpt', // 仅摘录
  'bookmark' // 仅书签
] as const

export type RecallSourceScope = (typeof RECALL_SOURCE_SCOPES)[number]

/** 非 all 时对应的 MemoryItem.type。 */
export function memoryItemTypeForSourceScope(
  scope: RecallSourceScope
): SupportedMemoryItemType | undefined {
  if (scope === 'all') {
    return undefined
  }
  return scope
}

/** 按来源范围过滤候选；all 原样返回。 */
export function filterMemoryItemsBySourceScope<T extends Pick<MemoryItem, 'type'>>(
  items: readonly T[],
  scope: RecallSourceScope | undefined
): T[] {
  const type = memoryItemTypeForSourceScope(scope ?? 'all')
  if (!type) {
    return [...items]
  }
  return items.filter(item => item.type === type)
}
