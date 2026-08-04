/**
 * 本机与云端 Memory 按 id 并集；同 id 取 updatedAt 较新者。
 * 用于开同步首次对齐，使两边最终一致。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/**
 * 比较 ISO 时间：a 是否严格新于 b。
 * 相等时返回 false（由调用方决定平局策略）。
 */
function isUpdatedAtNewer(a: string, b: string): boolean {
  return a > b
}

/**
 * 合并两侧条目。
 * - 仅出现在一侧：保留
 * - 同 id：`updatedAt` 较新胜；完全相等时保留 remote（账号侧稳定）
 * - 结果统一 `ownerId` 为当前账号
 */
export function mergeMemoryItemsByUpdatedAt(
  localItems: readonly MemoryItem[],
  remoteItems: readonly MemoryItem[],
  ownerId: string
): MemoryItem[] {
  const byId = new Map<string, MemoryItem>()

  for (const item of remoteItems) {
    byId.set(item.id, item)
  }

  for (const local of localItems) {
    const existing = byId.get(local.id)
    if (!existing) {
      byId.set(local.id, local)
      continue
    }
    if (isUpdatedAtNewer(local.updatedAt, existing.updatedAt)) {
      byId.set(local.id, local)
    }
    // 相等或更旧：保留已有（远程）
  }

  return [...byId.values()].map(item => (item.ownerId === ownerId ? item : { ...item, ownerId }))
}
