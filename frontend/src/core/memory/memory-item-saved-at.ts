import type { MemoryItem } from '@/core/memory/memory-item'

function parseIsoMs(value: string | undefined | null): number | null {
  if (!value) {
    return null
  }
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/**
 * 条目「保存/创建」时刻 ISO。
 * 书签优先 `chromeCreatedAt`（Chrome 星标时间），否则 `createdAt`；摘录为 `createdAt`。
 */
export function resolveMemoryItemSavedAtIso(item: MemoryItem): string {
  if (item.type === 'bookmark') {
    const chromeCreatedAt = item.payload.chromeCreatedAt?.trim()
    if (chromeCreatedAt) {
      return chromeCreatedAt
    }
  }
  return item.createdAt
}

/** 保存/创建时刻（epoch ms）；解析失败返回 null。 */
export function resolveMemoryItemSavedAtMs(item: MemoryItem): number | null {
  return parseIsoMs(resolveMemoryItemSavedAtIso(item))
}
