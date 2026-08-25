/**
 * 域名层 enrichment 基座（domainProfile）。
 * 同 host 多 path 共享站点级 tags/entities；不含 keywords/summary/note/embedding。
 * 最终条目 = domainProfile ∪ pageOverlay（URL 级 LLM/规则）∪ 既有 clues。
 */

import { normalizeDuplicateHostname } from '@/core/memory/derive-memory-duplicate-key'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { ExistingMemoryClueFields } from '@/core/memory/merge-memory-clue-enrichment'
import { mergeUniqueStrings } from '@/core/memory/enrich-memory-clues'
import { RecallObjectTypeSchema } from '@/core/recall/parse-recall-clue-types'

/** 可进入域名基座的 tags（对象类型 slug；页面特有词不进）。 */
const DOMAIN_PROFILE_TAG_SET = new Set<string>(RecallObjectTypeSchema.options)

/** 域名基座：只含站级 tags + 品牌向 entities。 */
export type DomainEnrichmentProfile = {
  tags: string[]
  entities: string[]
}

/** 从 MemoryItem 解析规范化 host；失败返回 null。 */
export function getMemoryItemHostname(item: MemoryItem): string | null {
  const raw =
    item.type === 'bookmark'
      ? item.payload.domain?.trim() || item.payload.url
      : item.payload.domain?.trim() || item.payload.sourceUrl
  if (!raw?.trim()) {
    return null
  }
  try {
    if (raw.includes('://')) {
      return normalizeDuplicateHostname(new URL(raw.trim()).hostname)
    }
    return normalizeDuplicateHostname(raw)
  } catch {
    return null
  }
}

/**
 * 域名 enrichment 复用键（书签/摘录均按 host）。
 * 有 note 仍可复用域名层（note 不进 profile）。
 */
export function getDomainEnrichmentReuseKey(item: MemoryItem): string | null {
  const host = getMemoryItemHostname(item)
  if (!host) {
    return null
  }
  return `enrich:d:${host}`
}

/** host 标签集合（去 TLD）：google.com → {google}；news.ycombinator.com → {news,ycombinator}。 */
export function hostBrandLabels(host: string): Set<string> {
  const labels = host
    .split('.')
    .map(part => part.trim().toLowerCase())
    .filter(part => part.length >= 2 && part !== 'www')
  // 常见公共后缀不单独当品牌
  const publicSuffix = new Set(['com', 'org', 'net', 'io', 'co', 'dev', 'app', 'ai', 'edu', 'gov'])
  return new Set(labels.filter(label => !publicSuffix.has(label)))
}

/**
 * 实体是否像该 host 的品牌（实体规范化后与 host 标签互含）。
 */
export function entityMatchesHostBrand(entity: string, host: string): boolean {
  const labels = hostBrandLabels(host)
  if (labels.size === 0) {
    return false
  }
  const normalized = entity
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
  if (normalized.length < 2) {
    return false
  }
  for (const label of labels) {
    if (normalized.includes(label) || label.includes(normalized)) {
      return true
    }
  }
  return false
}

/** profile 是否有可写信号。 */
export function hasDomainEnrichmentProfileSignal(profile: DomainEnrichmentProfile): boolean {
  return profile.tags.length > 0 || profile.entities.length > 0
}

/**
 * 从条目 clues 抽出域名基座（过滤页面级 keywords/summary）。
 * 无 host 或无站级信号 → null。
 */
export function extractDomainEnrichmentProfile(item: MemoryItem): DomainEnrichmentProfile | null {
  const host = getMemoryItemHostname(item)
  if (!host) {
    return null
  }

  const tags = (item.clues.tags ?? []).filter(tag =>
    DOMAIN_PROFILE_TAG_SET.has(tag.trim().toLowerCase())
  )
  const entities = (item.clues.entities ?? []).filter(entity =>
    entityMatchesHostBrand(entity, host)
  )

  const profile: DomainEnrichmentProfile = {
    tags: [...tags],
    entities: [...entities]
  }
  return hasDomainEnrichmentProfileSignal(profile) ? profile : null
}

/**
 * 将域名基座并入 existing（供 LLM merge 的底层）；不碰 keywords/summary。
 */
export function mergeDomainProfileIntoExisting(
  existing: ExistingMemoryClueFields,
  domain: DomainEnrichmentProfile | null | undefined
): ExistingMemoryClueFields {
  if (!domain || !hasDomainEnrichmentProfileSignal(domain)) {
    return existing
  }
  return {
    ...existing,
    tags: mergeUniqueStrings(existing.tags, domain.tags),
    entities: mergeUniqueStrings(existing.entities, domain.entities)
  }
}
