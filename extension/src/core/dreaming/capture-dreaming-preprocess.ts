/**
 * Capture 时 dreaming 预处理（纯函数）：去重键 + duplicate-group 链接形状。
 * 零网络、零 LLM；不写 clues、不删/合并 MemoryItem。
 * 持久化由 infrastructure 在 put 后写入派生 store。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  getEmbedReuseKey,
  getEnrichmentReuseKey,
  getMemoryFoldKey,
  serializeMemoryFoldKey
} from '@/core/memory/derive-memory-duplicate-key'

/** 同一折叠键下的多源链接（只标不删）。 */
export type DreamingDuplicateGroupLink = {
  /** `` `${ownerId}\0${foldKey}` `` */
  id: string
  ownerId: string
  foldKey: string
  enrichmentReuseKey: string | null
  embedReuseKey: string | null
  sourceMemoryItemId: string
}

/** 构建 duplicate-group 主键。 */
export function buildDreamingDuplicateGroupId(ownerId: string, foldKey: string): string {
  return `${ownerId}\0${foldKey}`
}

/**
 * 从即将落库的条目计算 dreaming 预处理键与链接。
 * 须在 withEnrichment 之前或之后均可：键只读 payload / note，不读 enrichment 产出。
 */
export function buildCaptureDreamingPreprocess(item: MemoryItem): DreamingDuplicateGroupLink {
  const foldKey = serializeMemoryFoldKey(getMemoryFoldKey(item))
  return {
    id: buildDreamingDuplicateGroupId(item.ownerId, foldKey),
    ownerId: item.ownerId,
    foldKey,
    enrichmentReuseKey: getEnrichmentReuseKey(item),
    embedReuseKey: getEmbedReuseKey(item),
    sourceMemoryItemId: item.id
  }
}
