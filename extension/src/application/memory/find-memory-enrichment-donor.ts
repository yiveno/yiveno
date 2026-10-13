/**
 * 在 IndexedDB 中查找同复用键的 donor（限量扫描）。
 */

import { getEmbedReuseKey, getEnrichmentReuseKey } from '@/core/memory/derive-memory-duplicate-key'
import {
  extractDomainEnrichmentProfile,
  getDomainEnrichmentReuseKey,
  hasDomainEnrichmentProfileSignal,
  type DomainEnrichmentProfile
} from '@/core/memory/domain-enrichment-profile'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  extractReusableEnrichmentFields,
  hasEnrichmentDonorSignal
} from '@/core/memory/reusable-enrichment-fields'
import type { MemoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

const DEFAULT_DONOR_SCAN_LIMIT = 500

/**
 * 查找可复用 enrichment 的兄弟条目（不含自身）。
 */
export async function findMemoryEnrichmentDonor(
  item: MemoryItem,
  repository: MemoryItemRepository,
  scanLimit = DEFAULT_DONOR_SCAN_LIMIT
): Promise<MemoryItem | null> {
  const key = getEnrichmentReuseKey(item)
  if (!key) {
    return null
  }

  const candidates = await repository.listByOwner({ limit: scanLimit })
  for (const candidate of candidates) {
    if (candidate.id === item.id) {
      continue
    }
    if (getEnrichmentReuseKey(candidate) !== key) {
      continue
    }
    if (!hasEnrichmentDonorSignal(candidate)) {
      continue
    }
    if (!extractReusableEnrichmentFields(candidate)) {
      continue
    }
    return candidate
  }
  return null
}

/**
 * 查找同 host 可抽出域名基座的 donor（不同 path 亦可）。
 */
export async function findMemoryDomainEnrichmentProfile(
  item: MemoryItem,
  repository: MemoryItemRepository,
  scanLimit = DEFAULT_DONOR_SCAN_LIMIT
): Promise<DomainEnrichmentProfile | null> {
  const key = getDomainEnrichmentReuseKey(item)
  if (!key) {
    return null
  }

  const candidates = await repository.listByOwner({ limit: scanLimit })
  for (const candidate of candidates) {
    if (candidate.id === item.id) {
      continue
    }
    if (getDomainEnrichmentReuseKey(candidate) !== key) {
      continue
    }
    const profile = extractDomainEnrichmentProfile(candidate)
    if (profile && hasDomainEnrichmentProfileSignal(profile)) {
      return profile
    }
  }
  return null
}

/** 查找可复用 embedding 向量的兄弟条目（不含自身）。 */
export async function findMemoryEmbeddingDonor(
  item: MemoryItem,
  repository: MemoryItemRepository,
  hasCurrentModelEmbedding: (candidate: MemoryItem) => boolean,
  scanLimit = DEFAULT_DONOR_SCAN_LIMIT
): Promise<MemoryItem | null> {
  const key = getEmbedReuseKey(item)
  if (!key) {
    return null
  }

  const candidates = await repository.listByOwner({ limit: scanLimit })
  for (const candidate of candidates) {
    if (candidate.id === item.id) {
      continue
    }
    if (getEmbedReuseKey(candidate) !== key) {
      continue
    }
    if (!hasCurrentModelEmbedding(candidate)) {
      continue
    }
    return candidate
  }
  return null
}
