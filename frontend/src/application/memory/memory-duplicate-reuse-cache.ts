/**
 * 会话内 enrichment / embedding 去重复用缓存（SW 生命周期）。
 * 同键第二条起跳过 Worker 请求。
 */

import type { ReusableEnrichmentFields } from '@/core/memory/reusable-enrichment-fields'

export type CachedEmbeddingVector = {
  embedding: number[]
  embeddingModel: string
  embeddingDim: number
}

const enrichmentReuseByKey = new Map<string, ReusableEnrichmentFields>()
const embeddingReuseByKey = new Map<string, CachedEmbeddingVector>()

export function getCachedEnrichmentReuse(key: string): ReusableEnrichmentFields | null {
  const hit = enrichmentReuseByKey.get(key)
  if (!hit) {
    return null
  }
  return {
    tags: [...hit.tags],
    keywords: [...hit.keywords],
    entities: [...hit.entities]
  }
}

export function setCachedEnrichmentReuse(key: string, fields: ReusableEnrichmentFields): void {
  enrichmentReuseByKey.set(key, {
    tags: [...fields.tags],
    keywords: [...fields.keywords],
    entities: [...fields.entities]
  })
}

export function getCachedEmbeddingReuse(key: string): CachedEmbeddingVector | null {
  const hit = embeddingReuseByKey.get(key)
  if (!hit) {
    return null
  }
  return {
    embedding: [...hit.embedding],
    embeddingModel: hit.embeddingModel,
    embeddingDim: hit.embeddingDim
  }
}

export function setCachedEmbeddingReuse(key: string, vector: CachedEmbeddingVector): void {
  embeddingReuseByKey.set(key, {
    embedding: [...vector.embedding],
    embeddingModel: vector.embeddingModel,
    embeddingDim: vector.embeddingDim
  })
}

/** 队列清空 / 测试重置时调用。 */
export function clearMemoryDuplicateReuseCaches(): void {
  enrichmentReuseByKey.clear()
  embeddingReuseByKey.clear()
}
