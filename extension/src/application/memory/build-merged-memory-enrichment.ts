/**
 * 规则 enrichment ⊕（可选）Worker LLM 提议 → 合并字段。
 * 不写 IndexedDB；Capture / 回填接线时调用本函数后再持久化。
 */

import {
  enrichMemoryClues,
  type EnrichMemoryCluesInput,
  type MemoryClueEnrichment
} from '@/core/memory/enrich-memory-clues'
import type { MemoryEnrichmentProposal } from '@/core/memory/memory-enrichment-proposal'
import {
  mergeMemoryClueEnrichment,
  type ExistingMemoryClueFields,
  type MergedMemoryClueEnrichment
} from '@/core/memory/merge-memory-clue-enrichment'
import { requestMemoryEnrichmentProposal } from '@/infrastructure/ai/memory-enrichment-api-client'
import { logger } from '@/infrastructure/logging/logger'

export type BuildMergedMemoryEnrichmentInput = {
  source: EnrichMemoryCluesInput
  existing?: ExistingMemoryClueFields | undefined
  /**
   * 是否请求 Worker LLM 提议。
   * 默认 false（规则-only）；开启后失败降级为规则合并。
   */
  requestLlmProposal?: boolean | undefined
}

export type BuildMergedMemoryEnrichmentResult = {
  rule: MemoryClueEnrichment
  proposal: MemoryEnrichmentProposal | null
  merged: MergedMemoryClueEnrichment
  /**
   * rule_only：未请求 LLM；
   * rule_plus_llm：LLM 成功合并；
   * llm_failed_degraded：LLM 失败降级规则；
   * quota_exceeded：日配额已满，调用方应熔断队列。
   */
  path: 'rule_only' | 'rule_plus_llm' | 'llm_failed_degraded' | 'quota_exceeded'
}

/** Worker 返回的 enrichment 日配额耗尽错误文案。 */
export function isMemoryEnrichmentQuotaExceededError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message === 'quota_exceeded' ||
    message.includes('quota_exceeded') ||
    message === 'Too Many Requests'
  )
}

/**
 * 计算可写回的 enrichment 合并结果。
 */
export async function buildMergedMemoryEnrichment(
  input: BuildMergedMemoryEnrichmentInput
): Promise<BuildMergedMemoryEnrichmentResult> {
  const rule = enrichMemoryClues(input.source)
  logger.info('MemoryEnrichment', '规则层完成', {
    tagCount: rule.tags.length,
    keywordCount: rule.keywords.length,
    entityCount: rule.entities.length,
    requestLlm: Boolean(input.requestLlmProposal)
  })

  if (!input.requestLlmProposal) {
    const merged = mergeMemoryClueEnrichment({
      existing: input.existing,
      rule
    })
    return { rule, proposal: null, merged, path: 'rule_only' }
  }

  try {
    const { proposal } = await requestMemoryEnrichmentProposal({
      ...input.source,
      ruleHints: {
        tags: rule.tags,
        keywords: rule.keywords,
        entities: rule.entities
      }
    })
    const merged = mergeMemoryClueEnrichment({
      existing: input.existing,
      rule,
      proposal
    })
    logger.info('MemoryEnrichment', '规则+LLM 合并完成', {
      tagCount: merged.tags.length,
      keywordCount: merged.keywords.length,
      entityCount: merged.entities.length,
      hasSummary: Boolean(merged.summary)
    })
    return { rule, proposal, merged, path: 'rule_plus_llm' }
  } catch (error) {
    const merged = mergeMemoryClueEnrichment({
      existing: input.existing,
      rule
    })
    if (isMemoryEnrichmentQuotaExceededError(error)) {
      logger.warn('MemoryEnrichment', 'LLM 提议因日配额耗尽，降级规则并通知熔断', {
        error: error instanceof Error ? error.message : String(error)
      })
      return { rule, proposal: null, merged, path: 'quota_exceeded' }
    }
    logger.warn('MemoryEnrichment', 'LLM 提议失败，降级规则合并', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { rule, proposal: null, merged, path: 'llm_failed_degraded' }
  }
}
