/**
 * 内容佐证门（Normative · 2026-09-11）：
 * `contentTerms` 非空时，邻域候选须对至少一个内容词有库内词面佐证；
 * 禁止仅靠弱 embedding / RRF / outcome 对交卷。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '@/core/recall/recall-result'
import {
  collectFilterIndexFields,
  compactRecallText,
  expandRecallHostClueVariants,
  latinInflectionVariants,
  looksLikeRecallHostClue,
  normalizeRecallText,
  stripRecallHostWwwPrefix
} from '@/core/recall/keyword-filter'
import { timeConfidenceForRelativeLabel } from '@/core/recall/parse-recall-clue'

/** 与 orchestrate.resolveEffectiveTimeConfidence 对齐（避免循环依赖）。 */
function effectiveTimeConfidenceForReopen(parsed: ParsedRecallClue): 'high' | 'low' | undefined {
  const range = parsed.timeRange
  if (!range) {
    return undefined
  }
  if (parsed.timeConfidence) {
    return parsed.timeConfidence
  }
  if (parsed.behaviorHints?.includes('recently_saved') && range.label === 'recent') {
    return 'high'
  }
  return timeConfidenceForRelativeLabel(range.label)
}

/** 归一化后可用于佐证的 contentTerms（去空、去重）。 */
export function normalizeContentTermsForCorroboration(
  contentTerms: readonly string[] | undefined
): string[] {
  if (!contentTerms || contentTerms.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of contentTerms) {
    const normalized = normalizeRecallText(term)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

/**
 * 单字段是否词面命中 contentTerm（与 keyword-filter exact 路径对齐：
 * 包含、compact、拉丁屈折、host www 变体；无同义词表）。
 */
function fieldCorroboratesTerm(originalField: string, term: string): boolean {
  const fieldText = normalizeRecallText(originalField)
  const compactField = compactRecallText(originalField)
  const compactTerm = compactRecallText(term)
  if (!fieldText || !term) {
    return false
  }
  if (fieldText.includes(term) || compactField.includes(term)) {
    return true
  }
  if (compactTerm.length >= 2 && compactField.includes(compactTerm)) {
    return true
  }
  for (const variant of latinInflectionVariants(term)) {
    if (variant === term) {
      continue
    }
    if (fieldText.includes(variant) || compactField.includes(compactRecallText(variant))) {
      return true
    }
  }
  if (looksLikeRecallHostClue(compactTerm)) {
    for (const hostVariant of expandRecallHostClueVariants(term)) {
      const compactVariant = compactRecallText(hostVariant)
      if (compactField.includes(compactVariant) || fieldText.includes(hostVariant)) {
        return true
      }
    }
    const tokenHost = stripRecallHostWwwPrefix(compactTerm.split('/')[0] ?? compactTerm)
    const fieldHost = stripRecallHostWwwPrefix(compactField.split('/')[0] ?? compactField)
    if (tokenHost.length >= 4 && fieldHost.includes(tokenHost)) {
      return true
    }
  }
  return false
}

/** 条目索引字段是否对任一 contentTerm 有词面佐证。 */
export function itemCorroboratesContentTerms(
  item: MemoryItem,
  contentTerms: readonly string[] | undefined
): boolean {
  const terms = normalizeContentTermsForCorroboration(contentTerms)
  if (terms.length === 0) {
    return true
  }
  const fields = collectFilterIndexFields(item)
  return terms.some(term => fields.some(field => fieldCorroboratesTerm(field.text, term)))
}

/**
 * 有 contentTerms 时只保留有佐证的命中；terms 空则原样返回。
 */
export function filterMatchesByContentTermCorroboration(
  matches: RecallMatch[],
  contentTerms: readonly string[] | undefined
): RecallMatch[] {
  const terms = normalizeContentTermsForCorroboration(contentTerms)
  if (terms.length === 0) {
    return matches
  }
  return matches.filter(match => itemCorroboratesContentTerms(match.item, terms))
}

/**
 * high 时间硬筛 + 非空 contentTerms + 佐证后 0 条 → 应尝试一次时间 soft 回退。
 */
export function shouldAttemptTimeSoftReopen(
  parsed: ParsedRecallClue,
  corroboratedCount: number
): boolean {
  if (corroboratedCount > 0) {
    return false
  }
  if (normalizeContentTermsForCorroboration(parsed.contentTerms).length === 0) {
    return false
  }
  if (!parsed.timeRange) {
    return false
  }
  return effectiveTimeConfidenceForReopen(parsed) === 'high'
}

/**
 * 构造时间 soft 回退用的 Parsed：保留槽位，强制 timeConfidence=low（不硬切窗外）。
 */
export function parsedClueForTimeSoftReopen(parsed: ParsedRecallClue): ParsedRecallClue {
  if (!parsed.timeRange) {
    return parsed
  }
  return {
    ...parsed,
    timeConfidence: 'low'
  }
}
