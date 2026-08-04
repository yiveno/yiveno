/**
 * 增量上云：选出需要 push 的条目。
 * 规则：无 lastPushedAt → 全量；否则 `updatedAt` 严格新于水位（含软删翻新）。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/** 过滤出相对上次成功 push 水位有变更的条目。 */
export function selectMemoryItemsToPush(
  items: readonly MemoryItem[],
  lastPushedAt: string | undefined
): MemoryItem[] {
  if (!lastPushedAt) {
    return [...items]
  }
  return items.filter(item => item.updatedAt > lastPushedAt)
}
