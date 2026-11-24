/**
 * 行为偏好结果的规则基线 framing（供 LLM 润色；不定死逐字文案）。
 * 只报次数与相对时间，绝不报内部 score。
 */

import type { BehaviorPreferenceRankingMeta } from '@/core/behavior/build-behavior-preference-result'
import type { PreferenceOperator } from '@/core/recall/parse-recall-clue-types'
import type { TranslateFn } from '@/core/i18n/translate'

const MS_PER_DAY = 86_400_000

function formatRelativeVisit(lastVisitTime: number, nowMs: number, t: TranslateFn): string {
  const ageDays = Math.max(0, Math.floor((nowMs - lastVisitTime) / MS_PER_DAY))
  if (ageDays <= 0) {
    return t('behavior_pref_relative_today')
  }
  if (ageDays === 1) {
    return t('behavior_pref_relative_yesterday')
  }
  if (ageDays < 7) {
    return t('behavior_pref_relative_days_ago', [String(ageDays)])
  }
  if (ageDays < 30) {
    const weeks = Math.max(1, Math.floor(ageDays / 7))
    return t('behavior_pref_relative_weeks_ago', [String(weeks)])
  }
  const months = Math.max(1, Math.floor(ageDays / 30))
  return t('behavior_pref_relative_months_ago', [String(months)])
}

function evidenceLine(
  operator: PreferenceOperator,
  visitCount: number,
  lastVisitTime: number,
  nowMs: number,
  t: TranslateFn
): string {
  const relative = formatRelativeVisit(lastVisitTime, nowMs, t)
  switch (operator) {
    case 'most_frequent':
      return t('behavior_pref_evidence_most_frequent', [String(visitCount), relative])
    case 'favorite':
      return t('behavior_pref_evidence_favorite', [String(visitCount), relative])
    case 'recent_frequent':
      return t('behavior_pref_evidence_recent_frequent', [String(visitCount), relative])
  }
}

/** 规则基线：点名 top1 + 依据字段；LLM 可润色。 */
export function renderBehaviorPreferenceRulesBaseline(
  meta: BehaviorPreferenceRankingMeta,
  t: TranslateFn,
  nowMs = Date.now()
): string {
  const top = meta.candidates[meta.shownOffset]
  if (!top) {
    return ''
  }
  const parts = [
    t('behavior_pref_framing_top', [top.domain]),
    evidenceLine(meta.operator, top.visitCount, top.lastVisitTime, nowMs, t)
  ]
  if (meta.pageAnsweredAsSite) {
    parts.push(t('behavior_pref_page_as_site_note'))
  }
  return parts.filter(Boolean).join(' ')
}
