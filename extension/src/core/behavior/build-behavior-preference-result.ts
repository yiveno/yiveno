/**
 * 偏好行为排序 → RecallResult（合成域名卡 + 依据字段）。
 */

import { buildBehaviorDomainMemoryItem } from '@/core/behavior/build-behavior-domain-memory-item'
import type { RankedBehaviorDomain } from '@/core/behavior/rank-behavior-domains'
import type {
  PreferenceOperator,
  PreferenceTarget,
  ParsedRecallClue
} from '@/core/recall/parse-recall-clue-types'
import type { RecallEmptyKind, RecallMatch, RecallResult } from '@/core/recall/recall-result'

/** 单域名展示依据（供 framing；勿展示内部 score）。 */
export type BehaviorPreferenceEvidence = {
  domain: string
  url: string
  visitCount: number
  lastVisitTime: number
}

/** 挂在 RecallResult 上的行为排序元数据。 */
export type BehaviorPreferenceRankingMeta = {
  operator: PreferenceOperator
  target: PreferenceTarget
  /** top 5 全量候选依据 */
  candidates: BehaviorPreferenceEvidence[]
  /** 本轮展示起点（0-based；轮换后） */
  shownOffset: number
  /** 轮换已到顶 */
  exhausted?: boolean
  /** page 目标时按网站答的诚实说明 */
  pageAnsweredAsSite?: boolean
}

export function toBehaviorMatches(
  ranked: readonly RankedBehaviorDomain[],
  ownerId: string,
  offset: number,
  showCount: number
): RecallMatch[] {
  const slice = ranked.slice(offset, offset + showCount)
  return slice.map(entry => ({
    item: buildBehaviorDomainMemoryItem({
      ownerId,
      domain: entry.domain,
      url: entry.topUrl
    }),
    score: entry.score,
    matchedFields: ['behavior_preference']
  }))
}

export function buildBehaviorPreferenceSuccessResult(input: {
  clue: string
  parsed: ParsedRecallClue
  ownerId: string
  ranked: RankedBehaviorDomain[]
  operator: PreferenceOperator
  target: PreferenceTarget
  shownOffset: number
  showCount?: number
}): RecallResult {
  const showCount = input.showCount ?? 3
  const offset = Math.max(0, input.shownOffset)
  const matches = toBehaviorMatches(input.ranked, input.ownerId, offset, showCount)
  const topPick = matches[0] ?? null
  const alsoPossible = matches.slice(1)
  const candidates: BehaviorPreferenceEvidence[] = input.ranked.map(entry => ({
    domain: entry.domain,
    url: entry.topUrl,
    visitCount: entry.visitCount,
    lastVisitTime: entry.lastVisitTime
  }))
  const exhausted = offset >= input.ranked.length || matches.length === 0

  return {
    outcome: topPick ? 'top_pick' : 'no_match',
    topPick,
    alsoPossible,
    totalRankedCount: Math.max(0, input.ranked.length - offset),
    clue: input.clue,
    parsed: input.parsed,
    ...(exhausted && !topPick ? { emptyKind: 'behavior_exhausted' as RecallEmptyKind } : {}),
    behaviorPreference: {
      operator: input.operator,
      target: input.target,
      candidates,
      shownOffset: offset,
      ...(exhausted ? { exhausted: true } : {}),
      ...(input.target === 'page' ? { pageAnsweredAsSite: true } : {})
    }
  }
}

export function buildBehaviorPreferenceEmptyResult(input: {
  clue: string
  parsed: ParsedRecallClue
  emptyKind: Extract<
    RecallEmptyKind,
    'behavior_not_imported' | 'behavior_empty' | 'behavior_topic_unsupported' | 'behavior_exhausted'
  >
  assistantReply?: string
}): RecallResult {
  return {
    outcome: 'no_match',
    topPick: null,
    alsoPossible: [],
    totalRankedCount: 0,
    clue: input.clue,
    parsed: input.parsed,
    emptyKind: input.emptyKind,
    ...(input.assistantReply ? { assistantReply: input.assistantReply } : {})
  }
}
