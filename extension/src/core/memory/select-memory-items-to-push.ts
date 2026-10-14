/**
 * 增量上云：选出需要 push 的条目。
 * 规则：先限云同步面（ADR-017 · 仅摘录）；无 lastPushedAt → 该面全量；否则 `updatedAt` 严格新于水位（含软删翻新）。
 */

import { filterCloudSyncableMemoryItems } from '@/core/memory/cloud-syncable-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 过滤出相对上次成功 push 水位有变更的云同步面条目。 */
export function selectMemoryItemsToPush(
  items: readonly MemoryItem[],
  lastPushedAt: string | undefined
): MemoryItem[] {
  const syncable = filterCloudSyncableMemoryItems(items)
  if (!lastPushedAt) {
    return syncable
  }
  return syncable.filter(item => item.updatedAt > lastPushedAt)
}
