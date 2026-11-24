/**
 * 偏好行为排序路径：读 behavior_stats → 排序 → RecallResult。
 * 不调 embedding、不进双池。
 */

import {
  buildBehaviorPreferenceEmptyResult,
  buildBehaviorPreferenceSuccessResult
} from '@/core/behavior/build-behavior-preference-result'
import { rankBehaviorDomains } from '@/core/behavior/rank-behavior-domains'
import { getBehaviorHistoryImportStatus } from '@/application/behavior/import-behavior-history-service'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallResult } from '@/core/recall/recall-result'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { behaviorStatsRepository } from '@/infrastructure/indexeddb/behavior-stats-repository'
import { logger } from '@/infrastructure/logging/logger'
import { t } from '@/infrastructure/i18n/t'

const TOP_CANDIDATES = 5
const SHOW_COUNT = 3

export type ResolveBehaviorPreferenceInput = {
  clue: string
  /** 合并后的 parsed */
  merged: ParsedRecallClue
  /** 本轮理解产物（用于判断是否本轮新设算子） */
  currentParsed: ParsedRecallClue
  behaviorShownCount: number
  nowMs?: number
}

/**
 * 若应走行为路径则返回结果；否则 null（交给文档池）。
 */
export async function resolveBehaviorPreferenceRecall(
  input: ResolveBehaviorPreferenceInput
): Promise<RecallResult | null> {
  const operator = input.merged.preferenceOperator
  if (!operator) {
    return null
  }

  const contentTerms = input.merged.contentTerms.filter(term => term.trim().length > 0)
  if (contentTerms.length > 0) {
    logger.info('BehaviorRecall', '偏好+主题尚未支持，诚实短路', {
      operator,
      contentTermCount: contentTerms.length
    })
    return buildBehaviorPreferenceEmptyResult({
      clue: input.clue,
      parsed: input.merged,
      emptyKind: 'behavior_topic_unsupported',
      assistantReply: t('behavior_pref_topic_unsupported')
    })
  }

  const importState = await getBehaviorHistoryImportStatus()
  if (!importState || importState.status !== 'completed') {
    logger.info('BehaviorRecall', '尚未导入浏览记录', {
      importStatus: importState?.status ?? null
    })
    return buildBehaviorPreferenceEmptyResult({
      clue: input.clue,
      parsed: input.merged,
      emptyKind: 'behavior_not_imported'
    })
  }

  const ownerId = await getCurrentOwnerId()
  const rows = await behaviorStatsRepository.listByOwner(ownerId)
  if (rows.length === 0) {
    logger.info('BehaviorRecall', '已导入但无可统计访问', { ownerId })
    return buildBehaviorPreferenceEmptyResult({
      clue: input.clue,
      parsed: input.merged,
      emptyKind: 'behavior_empty'
    })
  }

  const nowMs = input.nowMs ?? Date.now()
  const ranked = rankBehaviorDomains(rows, operator, nowMs, TOP_CANDIDATES)
  if (ranked.length === 0) {
    return buildBehaviorPreferenceEmptyResult({
      clue: input.clue,
      parsed: input.merged,
      emptyKind: 'behavior_empty'
    })
  }

  // 本轮自带新算子 → 从 top1 起，重置偏移；否则用会话已展示计数做轮换
  const isFreshOperatorQuery = Boolean(input.currentParsed.preferenceOperator)
  const isPureFollowUp =
    !isFreshOperatorQuery &&
    contentTerms.length === 0 &&
    !input.currentParsed.timeRange &&
    (input.currentParsed.contentTerms?.length ?? 0) === 0

  let shownOffset = 0
  if (isFreshOperatorQuery) {
    shownOffset = 0
  } else if (isPureFollowUp && input.behaviorShownCount > 0) {
    shownOffset = input.behaviorShownCount
  } else {
    shownOffset = 0
  }

  if (shownOffset >= ranked.length) {
    logger.info('BehaviorRecall', '行为候选轮换已到顶', {
      shownOffset,
      rankedCount: ranked.length
    })
    return buildBehaviorPreferenceEmptyResult({
      clue: input.clue,
      parsed: input.merged,
      emptyKind: 'behavior_exhausted',
      assistantReply: t('behavior_pref_exhausted')
    })
  }

  const target = input.merged.preferenceTarget ?? 'site'
  const result = buildBehaviorPreferenceSuccessResult({
    clue: input.clue,
    parsed: input.merged,
    ownerId,
    ranked,
    operator,
    target,
    shownOffset,
    showCount: SHOW_COUNT
  })

  logger.info('BehaviorRecall', '行为排序完成', {
    operator,
    target,
    rankedCount: ranked.length,
    shownOffset,
    topDomain: ranked[shownOffset]?.domain ?? null
  })
  return result
}
