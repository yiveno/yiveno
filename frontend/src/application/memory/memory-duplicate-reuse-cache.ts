/**
 * 会话内 enrichment / embedding / 域名基座去重复用缓存（SW 生命周期）。
 */

import type { DomainEnrichmentProfile } from '@/core/memory/domain-enrichment-profile'
import type { ReusableEnrichmentFields } from '@/core/memory/reusable-enrichment-fields'

export type CachedEmbeddingVector = {
  embedding: number[]
  embeddingModel: string
  embeddingDim: number
}

const enrichmentReuseByKey = new Map<string, ReusableEnrichmentFields>()
const domainProfileByKey = new Map<string, DomainEnrichmentProfile>()
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

export function getCachedDomainEnrichmentProfile(key: string): DomainEnrichmentProfile | null {
  const hit = domainProfileByKey.get(key)
  if (!hit) {
    return null
  }
  return {
    tags: [...hit.tags],
    entities: [...hit.entities]
  }
}

export function setCachedDomainEnrichmentProfile(
  key: string,
  profile: DomainEnrichmentProfile
): void {
  domainProfileByKey.set(key, {
    tags: [...profile.tags],
    entities: [...profile.entities]
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
  domainProfileByKey.clear()
  embeddingReuseByKey.clear()
}
