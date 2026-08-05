/**
 * P0 模板化追问：按解析结果缺槽位选一句最有信息增益的追问 + 建议芯片。
 * core 只返回 message key / 芯片值；UI 经 t() 本地化。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallOutcome } from '@/core/recall/recall-result'

/** 可追问的线索槽位。 */
/** 追问优先补的槽位。 */
export type RecallFollowUpSlot =
  | 'time' // 时间
  | 'objectType' // 对象类型
  | 'content' // 内容词
  | 'note' // 备注

/** 追问芯片（label/value 同源 i18n key，或固定中文值键）。 */
export type RecallFollowUpSuggestionSpec = {
  id: string
  /** 展示与填入 composer 的文案 key（经 t()）。 */
  labelKey: string
  /** 点击后填入 composer 的稳定值（不经 t()）；用于跨语言解析一致性。 */
  value?: string
}

export type RecallFollowUpPlan = {
  /** 主回复文案 key */
  replyKey: string
  /** 缺哪些槽（调试 / 测试） */
  missingSlots: RecallFollowUpSlot[]
  /** 主追问槽；无则 generic */
  primarySlot: RecallFollowUpSlot | null
  suggestions: RecallFollowUpSuggestionSpec[]
}

const SLOT_PRIORITY: RecallFollowUpSlot[] = ['content', 'time', 'objectType', 'note']

/** 列出口语解析后仍缺的槽位。 */
export function listMissingRecallSlots(parsed: ParsedRecallClue): RecallFollowUpSlot[] {
  const missing: RecallFollowUpSlot[] = []
  if (parsed.contentTerms.length === 0) {
    missing.push('content')
  }
  if (!parsed.timeRange) {
    missing.push('time')
  }
  if (!parsed.objectTypes || parsed.objectTypes.length === 0) {
    missing.push('objectType')
  }
  if (!parsed.noteHint) {
    missing.push('note')
  }
  return missing
}

/** 选信息增益最高的缺槽。 */
export function pickPrimaryFollowUpSlot(
  missingSlots: RecallFollowUpSlot[]
): RecallFollowUpSlot | null {
  for (const slot of SLOT_PRIORITY) {
    if (missingSlots.includes(slot)) {
      return slot
    }
  }
  return null
}

function replyKeyFor(outcome: 'need_a_clue' | 'no_match', slot: RecallFollowUpSlot | null): string {
  const prefix = outcome === 'need_a_clue' ? 'popup_followup_uncertain' : 'popup_followup_miss'
  if (!slot) {
    return `${prefix}_generic`
  }
  switch (slot) {
    case 'content':
      return `${prefix}_content`
    case 'time':
      return `${prefix}_time`
    case 'objectType':
      return `${prefix}_type`
    case 'note':
      return `${prefix}_note`
  }
}

function suggestionsForSlot(slot: RecallFollowUpSlot | null): RecallFollowUpSuggestionSpec[] {
  switch (slot) {
    case 'time':
      return [
        { id: 'time-yesterday', labelKey: 'popup_followup_chip_yesterday', value: 'yesterday' },
        {
          id: 'time-day-before',
          labelKey: 'popup_followup_chip_day_before',
          value: 'day before yesterday'
        },
        { id: 'time-last-week', labelKey: 'popup_followup_chip_last_week', value: 'last week' },
        { id: 'time-recent', labelKey: 'popup_followup_chip_recent', value: 'recently' }
      ]
    case 'objectType':
      return [
        { id: 'type-article', labelKey: 'popup_followup_chip_article', value: 'article' },
        { id: 'type-poem', labelKey: 'popup_followup_chip_poem', value: 'poem' },
        { id: 'type-code', labelKey: 'popup_followup_chip_code', value: 'code' },
        { id: 'type-song', labelKey: 'popup_followup_chip_song', value: 'song' }
      ]
    case 'content':
      return [
        {
          id: 'content-recently-saved',
          labelKey: 'popup_followup_chip_recently_saved',
          value: 'just saved'
        },
        {
          id: 'content-recently-opened',
          labelKey: 'popup_followup_chip_recently_opened',
          value: 'opened recently'
        },
        { id: 'content-site', labelKey: 'popup_suggest_site' },
        { id: 'content-quote', labelKey: 'popup_suggest_quote' }
      ]
    case 'note':
      return [{ id: 'note', labelKey: 'popup_suggest_note', value: 'my note' }]
    default:
      return [
        {
          id: 'recently-saved',
          labelKey: 'popup_followup_chip_recently_saved',
          value: 'just saved'
        },
        {
          id: 'current-site',
          labelKey: 'popup_followup_chip_current_site',
          value: 'from this site'
        },
        { id: 'site', labelKey: 'popup_suggest_site' },
        { id: 'quote', labelKey: 'popup_suggest_quote' },
        { id: 'note', labelKey: 'popup_suggest_note' },
        { id: 'type', labelKey: 'popup_suggest_type' }
      ]
  }
}

/**
 * 为 need_a_clue / no_match 生成追问计划。
 * top_pick 不调用本函数。
 */
export function buildRecallFollowUpPlan(
  parsed: ParsedRecallClue,
  outcome: Extract<RecallOutcome, 'need_a_clue' | 'no_match'>
): RecallFollowUpPlan {
  const missingSlots = listMissingRecallSlots(parsed)
  // 已有内容词时，优先追问时间/类型，而不是再要内容
  const askable =
    parsed.contentTerms.length > 0 ? missingSlots.filter(slot => slot !== 'content') : missingSlots
  const primarySlot = pickPrimaryFollowUpSlot(askable.length > 0 ? askable : missingSlots)

  return {
    replyKey: replyKeyFor(outcome, primarySlot),
    missingSlots,
    primarySlot,
    suggestions: suggestionsForSlot(primarySlot)
  }
}
