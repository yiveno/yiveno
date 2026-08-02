/**
 * Capture 后是否值得请求 LLM enrichment（稀疏门禁，纯函数）。
 * 不读网络 / storage；调用方另拦 bulk import 等场景。
 */

import { enrichInputFromMemoryItem } from '@/core/memory/enrich-memory-clues'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 标题/正文合计字符下限（过短不烧配额）。 */
export const LLM_MEMORY_ENRICHMENT_MIN_SIGNAL_CHARS = 4

export type LlmMemoryEnrichmentSkipReason =
  | 'has_summary' // 已有摘要，视为已 enrich 过
  | 'signal_too_short' // 标题+正文过短
  | 'ok' // 可请求

/**
 * 判断是否应对该 MemoryItem 发起异步 LLM enrichment。
 */
export function evaluateLlmMemoryEnrichmentGate(item: MemoryItem): {
  shouldRequest: boolean
  reason: LlmMemoryEnrichmentSkipReason
} {
  if (item.clues.summary?.trim()) {
    return { shouldRequest: false, reason: 'has_summary' }
  }

  const source = enrichInputFromMemoryItem(item)
  const signal = [source.title, source.text, source.note].filter(Boolean).join('').trim()
  if (signal.length < LLM_MEMORY_ENRICHMENT_MIN_SIGNAL_CHARS) {
    return { shouldRequest: false, reason: 'signal_too_short' }
  }

  return { shouldRequest: true, reason: 'ok' }
}

/** 是否应请求 LLM enrichment。 */
export function shouldRequestLlmMemoryEnrichment(item: MemoryItem): boolean {
  return evaluateLlmMemoryEnrichmentGate(item).shouldRequest
}
