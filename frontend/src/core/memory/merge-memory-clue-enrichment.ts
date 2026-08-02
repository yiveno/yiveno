/**
 * 将「已有 clues ⊕ 规则 enrichment ⊕ LLM 提议」合并为可写回字段。
 * 优先级见 mergeMemoryClueEnrichment；不写 note / embedding。
 */

import type { MemoryClueEnrichment } from '@/core/memory/enrich-memory-clues'
import { mergeUniqueStrings } from '@/core/memory/enrich-memory-clues'
import type { MemoryEnrichmentProposal } from '@/core/memory/memory-enrichment-proposal'

/** 合并时可读的已有线索（不含 note；note 永不由 enrichment 改写）。 */
export type ExistingMemoryClueFields = {
  tags?: string[] | undefined
  keywords?: string[] | undefined
  entities?: string[] | undefined
  /** 已有摘要；非空则保留，LLM 不得覆盖 */
  summary?: string | undefined
}

export type MergeMemoryClueEnrichmentInput = {
  existing?: ExistingMemoryClueFields | undefined
  /** 规则层产物（enrichMemoryClues） */
  rule: MemoryClueEnrichment
  /** 已 Zod 校验的 LLM 提议；缺省 = 仅规则 */
  proposal?: MemoryEnrichmentProposal | null | undefined
}

/** 合并结果：可直接写入 clues 对应字段。 */
export type MergedMemoryClueEnrichment = {
  tags: string[]
  keywords: string[]
  entities: string[]
  /**
   * 仅当 existing.summary 为空且 proposal.summary 有值时给出；
   * undefined 表示调用方勿改 summary。
   */
  summary?: string | undefined
}

/**
 * Merge 策略（Normative）：
 * 1. tags / keywords / entities：existing → rule → proposal 保序并集（大小写不敏感去重）
 * 2. proposal.objectType 追加进 tags（与规则类型 slug 对齐）
 * 3. summary：existing 非空则保留；否则采用 proposal.summary
 * 4. 永不产出 note / embedding（调用方勿把本结果写进这两项）
 */
export function mergeMemoryClueEnrichment(
  input: MergeMemoryClueEnrichmentInput
): MergedMemoryClueEnrichment {
  const proposal = input.proposal ?? null
  const proposalTags = [
    ...(proposal?.objectType ? [proposal.objectType] : []),
    ...(proposal?.tags ?? [])
  ]

  const tags = mergeUniqueStrings(input.existing?.tags, input.rule.tags, proposalTags)
  const keywords = mergeUniqueStrings(
    input.existing?.keywords,
    input.rule.keywords,
    proposal?.keywords
  )
  const entities = mergeUniqueStrings(
    input.existing?.entities,
    input.rule.entities,
    proposal?.entities
  )

  const existingSummary = input.existing?.summary?.trim()
  const proposalSummary = proposal?.summary?.trim()
  const summary =
    existingSummary && existingSummary.length > 0
      ? undefined
      : proposalSummary && proposalSummary.length > 0
        ? proposalSummary
        : undefined

  return {
    tags,
    keywords,
    entities,
    ...(summary !== undefined ? { summary } : {})
  }
}

/**
 * 将合并结果套到 MemoryItem.clues 形状（浅合并；不碰 note / embedding / 行为字段）。
 */
export function applyMergedEnrichmentToClues<
  T extends {
    tags?: string[] | undefined
    keywords?: string[] | undefined
    entities?: string[] | undefined
    summary?: string | undefined
  }
>(clues: T, merged: MergedMemoryClueEnrichment): T {
  return {
    ...clues,
    tags: merged.tags,
    keywords: merged.keywords,
    entities: merged.entities,
    ...(merged.summary !== undefined ? { summary: merged.summary } : {})
  }
}
