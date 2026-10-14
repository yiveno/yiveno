/**
 * 内容佐证门（Normative · 2026-09-11）：
 * `contentTerms` 非空时，邻域候选须对至少一个内容词有库内词面佐证；
 * 禁止仅靠弱 embedding / RRF / outcome 对交卷。
 * 佐证与 Filter 同源：剥掉弱偏好残留后再判。
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

/**
 * 弱偏好/发令残留：可进 contentTerms，但不得当 Filter 词面，也不得单独撑过佐证门。
 * `effectiveContentTermsForRecall` 是本模块唯一导出源；调用方统一从此处 import，避免
 * 多文件 re-export 让 reviewer 误判为「同源多路径」（历史上曾如此，现已收敛）。
 *
 * 注意：**不要**把 `bored` 放进本表——它常是真实主题词（如标题 The joy of being bored）。
 * 「i feel bored / pick something fun」类助手发令由 `shouldSkipRecallAsZeroAnchor` +
 * `ASSISTANT_IMPERATIVE_SURFACES` 拦截，不得靠剥掉 bored 误伤内容找回。
 */
const WEAK_PREFERENCE_RESIDUAL_TERMS = new Set([
  'play',
  'put',
  'like',
  'love',
  'want',
  'some',
  'from',
  'feel',
  'please',
  'me',
  'pick',
  'something',
  'fun',
  'for',
  'recommend',
  'suggest',
  'good',
  'should',
  'tonight',
  'watch',
  'watching'
])

/**
 * 检索/佐证用内容词：剥掉弱偏好残留。
 * Filter 与佐证门必须同源，禁止 `like`/`good` 等放行弱 embedding。
 */
export function effectiveContentTermsForRecall(parsed: ParsedRecallClue): string[] {
  return parsed.contentTerms.filter(term => {
    const normalized = normalizeRecallText(term)
    if (!normalized) {
      return false
    }
    return !WEAK_PREFERENCE_RESIDUAL_TERMS.has(normalized)
  })
}

/** 与 orchestrate.resolveEffectiveTimeConfidence 对齐（避免循环依赖）。 */
function effectiveTimeConfidenceForReopen(parsed: ParsedRecallClue): 'high' | 'low' | undefined {
  const hasRecentSaved = Boolean(parsed.behaviorHints?.includes('recently_saved'))
  if (!parsed.timeRange && !hasRecentSaved) {
    return undefined
  }
  if (parsed.timeConfidence) {
    return parsed.timeConfidence
  }
  if (parsed.timeRange) {
    if (hasRecentSaved && parsed.timeRange.label === 'recent') {
      return 'high'
    }
    return timeConfidenceForRelativeLabel(parsed.timeRange.label)
  }
  // 无显式 timeRange、仅刚存 → 合成 recent 按 high（ADR-011）
  if (hasRecentSaved) {
    return 'high'
  }
  return undefined
}

/** 归一化后可用于佐证的 contentTerms（去空、去重、剥弱残留）。 */
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
    if (WEAK_PREFERENCE_RESIDUAL_TERMS.has(normalized)) {
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
 * 有有效 contentTerms 时只保留有佐证的命中；有效词空则原样返回。
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
 * Hybrid-mode 软佐证 penalty（实验三修复 · 2026-09-20）：
 * Hybrid 路径已有 embedding 独立验证，不应被 understanding 层的 contentTerms 错误 hard-filter。
 * 改为：未佐证项 score 扣 penalty，候选项降序排序，但保留命中。
 * penalty 大小：参照 `RECALL_ORCHESTRATION_*` 加成（3–12），取中段 8 避免压过 keyword hit。
 * 保证 score ∈ [1, +∞)：避免和 filterKeywordMatchesBeforeCollapse 的 minScore 冲突。
 *
 * @param matches 已打分候选（含 matchedFields 标记 embedding/title 等）
 * @param contentTerms understanding 层解析的 contentTerms
 * @returns 已应用佐证 penalty 的候选（未佐证得分降；佐证项原样）
 */
export const HYBRID_CORROBORATION_SOFT_PENALTY = 8

export function softPenalizeMatchesByContentTermCorroboration(
  matches: RecallMatch[],
  contentTerms: readonly string[] | undefined
): RecallMatch[] {
  const terms = normalizeContentTermsForCorroboration(contentTerms)
  if (terms.length === 0 || matches.length === 0) {
    return matches
  }
  return matches.map(match => {
    if (itemCorroboratesContentTerms(match.item, terms)) {
      return match
    }
    const penalizedScore = Math.max(1, match.score - HYBRID_CORROBORATION_SOFT_PENALTY)
    return {
      ...match,
      score: penalizedScore
    }
  })
}

/**
 * high 时间硬筛（含刚存合成）+ 非空有效 contentTerms + 佐证后 0 条 → 应尝试一次时间 soft 回退。
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
  const hasTimeConstraint =
    Boolean(parsed.timeRange) || Boolean(parsed.behaviorHints?.includes('recently_saved'))
  if (!hasTimeConstraint) {
    return false
  }
  return effectiveTimeConfidenceForReopen(parsed) === 'high'
}

/**
 * 构造时间 soft 回退用的 Parsed：保留槽位，强制 timeConfidence=low（不硬切窗外）。
 * 无显式 timeRange 的刚存也可 soft（confidence 降为 low）。
 */
export function parsedClueForTimeSoftReopen(parsed: ParsedRecallClue): ParsedRecallClue {
  return {
    ...parsed,
    timeConfidence: 'low'
  }
}
