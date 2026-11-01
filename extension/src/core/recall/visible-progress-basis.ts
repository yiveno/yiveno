/**
 * 结果页轻解释：按本轮真实槽位列出「主要依据」维度（§7.0）。
 * 禁止编造未参与的维度。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'

/** 可展示的依据维度（产品文案片段）。 */
export type RecallVisibleProgressBasisKind =
  | 'timing' // 大致时间
  | 'source' // 来源印象（域名桶等）
  | 'purpose' // 用途 / 内容线索

export interface SelectRecallVisibleProgressBasisInput {
  parsed?: ParsedRecallClue | null
  /** 有候选 Framing 时：域名桶视为来源印象信号。 */
  framingFacts?: RecallFramingFacts | null
}

/**
 * 从合并 Parsed + 可选 Framing 推导本轮实际用到的依据维度。
 */
export function selectRecallVisibleProgressBasisKinds(
  input: SelectRecallVisibleProgressBasisInput
): RecallVisibleProgressBasisKind[] {
  const { parsed, framingFacts } = input
  const kinds: RecallVisibleProgressBasisKind[] = []

  if (parsed?.timeRange) {
    kinds.push('timing')
  }

  const hasDomainBucket =
    framingFacts?.kind === 'candidates' &&
    framingFacts.buckets.some(bucket => bucket.labelKey === 'framing_bucket_domain')
  if (hasDomainBucket) {
    kinds.push('source')
  }

  const hasPurpose =
    (parsed?.contentTerms?.length ?? 0) > 0 ||
    (parsed?.behaviorHints?.length ?? 0) > 0 ||
    parsed?.noteHint === true ||
    (parsed?.objectTypes?.length ?? 0) > 0
  if (hasPurpose) {
    kinds.push('purpose')
  }

  return kinds
}

/**
 * 结果正文「Mainly based on」与 Heard as 协同：
 * - 无回声：保留全部真实依据维度
 * - 有回声：去掉与芯片重叠的 timing/purpose，仅保留回声未覆盖的 source（域名桶）
 */
export function selectBasisKindsForResultCopy(
  kinds: readonly RecallVisibleProgressBasisKind[],
  options: { omitEchoOverlap: boolean }
): RecallVisibleProgressBasisKind[] {
  if (!options.omitEchoOverlap) {
    return [...kinds]
  }
  return kinds.filter(kind => kind === 'source')
}
