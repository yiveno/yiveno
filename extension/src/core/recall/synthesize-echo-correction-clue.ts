/**
 * 理解回声纠错 → 稳定英文 refine 短句（走现有 parser / merge，不新开 message type）。
 * 本切片：时间/类型 Replace；内容词 Exclude（`not the …`）。
 */

import {
  RECALL_OBJECT_TYPE_CANONICAL_SURFACES,
  type RecallRelativeTimeLabel
} from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/** 纠错菜单里提供的相对时间（闭集 · 常用档）。 */
export const ECHO_CORRECTION_TIME_OPTIONS: readonly RecallRelativeTimeLabel[] = [
  'today',
  'yesterday',
  'day_before_yesterday',
  'last_week',
  'recent',
  'a_while_ago',
  'last_month',
  'few_months_ago',
  'long_ago'
] as const

/**
 * 合成 clue 用的短英文 surface（优先可解析短词，避免「a few days ago」过长用户气泡）。
 */
const PREFERRED_TIME_SURFACES: Record<RecallRelativeTimeLabel, string> = {
  today: 'today',
  yesterday: 'yesterday',
  day_before_yesterday: 'day before yesterday',
  last_week: 'last week',
  recent: 'recently',
  a_while_ago: 'a while ago',
  last_month: 'last month',
  few_months_ago: 'a few months ago',
  long_ago: 'long ago'
}

/** 时间 label → 合成 clue 用的英文 surface。 */
export function englishSurfaceForTimeLabel(label: RecallRelativeTimeLabel): string {
  return PREFERRED_TIME_SURFACES[label]
}

/** 换相对时间：本轮有 time → merge 覆盖 accumulated.timeRange。 */
export function synthesizeEchoTimeReplaceClue(nextLabel: RecallRelativeTimeLabel): string {
  return englishSurfaceForTimeLabel(nextLabel)
}

/** 换对象类型：本轮有 objectTypes → merge 覆盖。 */
export function synthesizeEchoObjectTypeReplaceClue(nextType: RecallObjectType): string {
  return RECALL_OBJECT_TYPE_CANONICAL_SURFACES[nextType]
}

/**
 * 丢掉某内容词：写成明确排除跨度，进 excludeContentTerms，并与正词冲突消解。
 * @see exclude-content-terms `not the …`
 */
export function synthesizeEchoContentTermExcludeClue(term: string): string {
  const trimmed = term.trim()
  if (!trimmed) {
    return ''
  }
  return `not the ${trimmed}`
}
