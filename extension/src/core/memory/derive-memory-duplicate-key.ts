/**
 * MemoryItem 重复键：Recall 折叠 / enrichment 复用 / embedding 复用。
 * 库内仍允许并存；键只用于结果折叠与派生字段去重请求。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/** Recall 折叠键（序列化前）。 */
export type MemoryFoldKey =
  | { kind: 'bookmark'; url: string }
  | { kind: 'excerpt'; text: string }
  | { kind: 'singleton'; id: string }

/** 摘录 enrichment 复用：正文最短字符数（过短易误撞）。 */
export const ENRICHMENT_REUSE_MIN_EXCERPT_CHARS = 32

/** 主机名规范化：小写，去掉前导 www。 */
export function normalizeDuplicateHostname(hostname: string): string {
  const lower = hostname.trim().toLowerCase()
  return lower.startsWith('www.') ? lower.slice(4) : lower
}

/**
 * 书签折叠 / enrichment 复用用 URL 规范化（展示 URL 仍用原值）。
 * - host 小写、去 www
 * - 去掉默认端口
 * - 非根 path 去尾部 /
 * - 保留 protocol / query / hash
 */
export function canonicalizeBookmarkDuplicateUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    parsed.username = ''
    parsed.password = ''
    parsed.hostname = normalizeDuplicateHostname(parsed.hostname)
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = ''
    }
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    }
    return parsed.href
  } catch {
    return url.trim()
  }
}

/** Recall 折叠键（与产品 §3.1 对齐）。 */
export function getMemoryFoldKey(item: MemoryItem): MemoryFoldKey {
  switch (item.type) {
    case 'bookmark': {
      const url = item.payload.url.trim()
      if (!url) {
        return { kind: 'singleton', id: item.id }
      }
      return { kind: 'bookmark', url: canonicalizeBookmarkDuplicateUrl(url) }
    }
    case 'text_excerpt': {
      const text = item.payload.selectedText.trim()
      if (!text) {
        return { kind: 'singleton', id: item.id }
      }
      return { kind: 'excerpt', text }
    }
  }
}

/** 折叠键稳定序列化。 */
export function serializeMemoryFoldKey(key: MemoryFoldKey): string {
  switch (key.kind) {
    case 'bookmark':
      return `b:${key.url}`
    case 'excerpt':
      return `e:${key.text}`
    case 'singleton':
      return `id:${key.id}`
  }
}

function normalizeEmbedPart(value: string | undefined): string {
  return value?.trim() ?? ''
}

/**
 * 是否允许 enrichment 复用（任一侧有 note 或摘录过短则不复用）。
 */
export function isEligibleForEnrichmentReuse(item: MemoryItem): boolean {
  if (item.clues.note?.trim()) {
    return false
  }
  switch (item.type) {
    case 'bookmark':
      return Boolean(item.payload.url.trim())
    case 'text_excerpt':
      return item.payload.selectedText.trim().length >= ENRICHMENT_REUSE_MIN_EXCERPT_CHARS
  }
}

/**
 * enrichment 复用键：书签 = 规范化 URL；摘录 = trim 正文（不含 sourceUrl）。
 * 不可复用时返回 null。
 */
export function getEnrichmentReuseKey(item: MemoryItem): string | null {
  if (!isEligibleForEnrichmentReuse(item)) {
    return null
  }
  switch (item.type) {
    case 'bookmark': {
      const url = item.payload.url.trim()
      if (!url) {
        return null
      }
      return `enrich:b:${canonicalizeBookmarkDuplicateUrl(url)}`
    }
    case 'text_excerpt': {
      const text = item.payload.selectedText.trim()
      return `enrich:e:${text}`
    }
  }
}

/**
 * embedding 复用键：书签 = 规范化 URL；摘录 = pageTitle + 正文 + note。
 */
export function getEmbedReuseKey(item: MemoryItem): string | null {
  switch (item.type) {
    case 'bookmark': {
      const url = item.payload.url.trim()
      if (!url) {
        return null
      }
      return `embed:b:${canonicalizeBookmarkDuplicateUrl(url)}`
    }
    case 'text_excerpt': {
      const title = normalizeEmbedPart(item.payload.pageTitle)
      const text = normalizeEmbedPart(item.payload.selectedText)
      const note = normalizeEmbedPart(item.clues.note)
      if (!text) {
        return null
      }
      return `embed:x:${title}\n${text}\n${note}`
    }
  }
}
