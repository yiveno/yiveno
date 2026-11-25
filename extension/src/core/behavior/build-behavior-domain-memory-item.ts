/**
 * 行为排序结果 → 可复用 RecallResultCard 的合成书签 MemoryItem。
 * 不入库；仅本轮结果展示。id 由域名确定性派生（合法 UUID）。
 */

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import type { BookmarkMemoryItem } from '@/core/memory/memory-item'
import { extractDomainFromUrl } from '@/core/memory/payload'

/** 将域名哈希成稳定 UUID（v4 形；版本/变体位固定）。 */
export function behaviorDomainSyntheticId(domain: string): string {
  const input = `yiveno:behavior-domain:${domain.trim().toLowerCase()}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code
    h2 = Math.imul(h2, 0x811c9dc5)
  }
  const hex = (
    (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
  ).padEnd(32, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** 构造域名卡用的合成 bookmark 条目。 */
export function buildBehaviorDomainMemoryItem(input: {
  ownerId: string
  domain: string
  url: string
  nowIso?: string
  /** 最近访问毫秒时间戳；有则写入 clues.lastOpenedAt 供卡面「最近访问」行 */
  lastVisitTime?: number
}): BookmarkMemoryItem {
  const domain = input.domain.trim() || extractDomainFromUrl(input.url) || 'unknown'
  const lastVisitIso =
    input.lastVisitTime !== undefined && input.lastVisitTime > 0
      ? new Date(input.lastVisitTime).toISOString()
      : undefined
  const item = createBookmarkMemoryItem({
    ownerId: input.ownerId,
    sourceLocalProfileId: input.ownerId,
    captureEntry: 'sync',
    ...(input.nowIso ? { now: () => input.nowIso! } : {}),
    payload: {
      title: domain,
      url: input.url,
      domain
    },
    ...(lastVisitIso ? { clues: { lastOpenedAt: lastVisitIso } } : {})
  })
  return { ...item, id: behaviorDomainSyntheticId(domain) }
}
