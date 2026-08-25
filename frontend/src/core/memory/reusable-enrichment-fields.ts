/**
 * enrichment 复用字段：只拷 tags / keywords / entities，不拷 summary / note / embedding。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/** 可从同键兄弟条目复用的 LLM 派生字段。 */
export type ReusableEnrichmentFields = {
  tags: string[]
  keywords: string[]
  entities: string[]
}

/** 是否已有可复用的 enrichment 信号（至少 keywords 或 entities）。 */
export function hasEnrichmentDonorSignal(item: MemoryItem): boolean {
  const keywords = item.clues.keywords ?? []
  const entities = item.clues.entities ?? []
  return keywords.length > 0 || entities.length > 0
}

/** 从 donor 抽出可复用字段；无信号时返回 null。 */
export function extractReusableEnrichmentFields(item: MemoryItem): ReusableEnrichmentFields | null {
  if (!hasEnrichmentDonorSignal(item)) {
    return null
  }
  return {
    tags: [...(item.clues.tags ?? [])],
    keywords: [...(item.clues.keywords ?? [])],
    entities: [...(item.clues.entities ?? [])]
  }
}
