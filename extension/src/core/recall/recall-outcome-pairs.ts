/**
 * §7.2 P3：本机 (clue → target / none) 对用于重排。
 * 仅消费 strong/medium settled 正例与 none_in_results 硬负例；禁止人设建档。
 */

import { normalizeRecallText } from '@/core/recall/keyword-filter'
import { itemCorroboratesContentTerms } from '@/core/recall/content-term-corroboration'
import type { RecallMatch } from '@/core/recall/recall-result'
import type {
  RecallOutcomeConfidence,
  RecallOutcomeLabel,
  RecallOutcomeSource
} from '@/core/recall/recall-outcome'

/** 指纹命中正例（曾 settled / 出口 Found 为答案）软加成。 */
export const RECALL_OUTCOME_PAIR_POSITIVE_BOOST = 12

/** 指纹命中硬负例（该 clue 下曾「都不是这些」）降权。 */
export const RECALL_OUTCOME_PAIR_NEGATIVE_PENALTY = 14

/** 规范化线索指纹：小写、空白折叠，供精确对拍。 */
export function fingerprintRecallClue(clue: string): string {
  return normalizeRecallText(clue).replace(/\s+/g, ' ').trim()
}

/** 持久化的一条 Outcome 对（本机 ring buffer）。 */
export interface RecallOutcomePairRecord {
  fingerprint: string
  /** 展示/调试预览，不参与匹配 */
  cluePreview: string
  label: Extract<RecallOutcomeLabel, 'target' | 'none_in_results'>
  targetId?: string
  negativeIds?: string[]
  confidence?: RecallOutcomeConfidence
  source: RecallOutcomeSource
  createdAt: string
}

/**
 * 按指纹对候选分做 P3 调整：正例升、硬负例降，再按分排序。
 * contentTerms 非空时：正例 +升权仅当条目已通过内容佐证（禁止钉死弱语义假阳性）。
 */
export function applyOutcomePairScoreAdjustments(
  matches: RecallMatch[],
  fingerprint: string,
  pairs: RecallOutcomePairRecord[],
  options?: { contentTerms?: readonly string[] }
): RecallMatch[] {
  const key = fingerprint.trim()
  if (!key || matches.length === 0 || pairs.length === 0) {
    return matches
  }

  const contentTerms = options?.contentTerms
  const requireCorroboration = Boolean(contentTerms && contentTerms.length > 0)

  const positiveIds = new Set<string>()
  const negativeIds = new Set<string>()
  for (const pair of pairs) {
    if (pair.fingerprint !== key) {
      continue
    }
    if (pair.label === 'target' && pair.targetId) {
      positiveIds.add(pair.targetId)
    }
    if (pair.label === 'none_in_results' && pair.negativeIds) {
      for (const id of pair.negativeIds) {
        if (id) {
          negativeIds.add(id)
        }
      }
    }
  }

  if (positiveIds.size === 0 && negativeIds.size === 0) {
    return matches
  }

  const adjusted = matches.map(match => {
    let delta = 0
    if (positiveIds.has(match.item.id)) {
      const allowPositive =
        !requireCorroboration || itemCorroboratesContentTerms(match.item, contentTerms)
      if (allowPositive) {
        delta += RECALL_OUTCOME_PAIR_POSITIVE_BOOST
      }
    }
    if (negativeIds.has(match.item.id)) {
      delta -= RECALL_OUTCOME_PAIR_NEGATIVE_PENALTY
    }
    if (delta === 0) {
      return match
    }
    return {
      ...match,
      score: Math.max(0, match.score + delta),
      matchedFields: match.matchedFields.includes('outcomePair')
        ? match.matchedFields
        : [...match.matchedFields, 'outcomePair']
    }
  })

  adjusted.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })
  return adjusted
}

/** 从结算事件构造可持久化对；不可学则返回 null。 */
export function buildRecallOutcomePairRecord(input: {
  effectiveClue: string
  label: RecallOutcomeLabel
  targetId?: string
  resultIds: string[]
  confidence?: RecallOutcomeConfidence
  source: RecallOutcomeSource
  createdAt?: string
  /** 是否允许写入 settled 级正例（与校准门一致） */
  countsAsSettled: boolean
}): RecallOutcomePairRecord | null {
  const fingerprint = fingerprintRecallClue(input.effectiveClue)
  if (!fingerprint) {
    return null
  }

  if (input.label === 'target') {
    if (!input.countsAsSettled || !input.targetId) {
      return null
    }
    return {
      fingerprint,
      cluePreview: input.effectiveClue.trim().slice(0, 80),
      label: 'target',
      targetId: input.targetId,
      ...(input.confidence ? { confidence: input.confidence } : {}),
      source: input.source,
      createdAt: input.createdAt ?? new Date().toISOString()
    }
  }

  if (input.label === 'none_in_results') {
    const negativeIds = [...new Set(input.resultIds.map(id => id.trim()).filter(Boolean))]
    if (negativeIds.length === 0) {
      return null
    }
    return {
      fingerprint,
      cluePreview: input.effectiveClue.trim().slice(0, 80),
      label: 'none_in_results',
      negativeIds,
      ...(input.confidence ? { confidence: input.confidence } : {}),
      source: input.source,
      createdAt: input.createdAt ?? new Date().toISOString()
    }
  }

  return null
}
