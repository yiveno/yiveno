/**
 * 有方向追问：按合并后 parsed 缺槽与 emptyKind 选信息增益最高的下一问 + 芯片。
 * 禁止已解析槽位再问；禁止全局固定类型问卷当死模板。
 * core 只返回 message key / 芯片值；UI 经 t() 本地化。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallEmptyKind, RecallOutcome } from '@/core/recall/recall-result'

/** 可追问的线索槽位。 */
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
  /** 主追问槽；无则 generic / 约束空 */
  primarySlot: RecallFollowUpSlot | null
  suggestions: RecallFollowUpSuggestionSpec[]
}

const SLOT_PRIORITY: RecallFollowUpSlot[] = ['content', 'time', 'objectType', 'note']

const TIME_SUGGESTIONS: RecallFollowUpSuggestionSpec[] = [
  { id: 'time-yesterday', labelKey: 'popup_followup_chip_yesterday', value: 'yesterday' },
  {
    id: 'time-day-before',
    labelKey: 'popup_followup_chip_day_before',
    value: 'day before yesterday'
  },
  { id: 'time-last-week', labelKey: 'popup_followup_chip_last_week', value: 'last week' },
  { id: 'time-recent', labelKey: 'popup_followup_chip_recent', value: 'recently' }
]

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

/**
 * 类型芯片：覆盖 canonical 对象类型（含 video），避免旧四选一漏影音。
 * 仅在真正缺 objectType 时使用；已有类型时不得调用。
 */
function objectTypeSuggestions(): RecallFollowUpSuggestionSpec[] {
  return [
    { id: 'type-article', labelKey: 'popup_followup_chip_article', value: 'article' },
    { id: 'type-video', labelKey: 'popup_followup_chip_video', value: 'video' },
    { id: 'type-song', labelKey: 'popup_followup_chip_song', value: 'song' },
    { id: 'type-code', labelKey: 'popup_followup_chip_code', value: 'code' },
    { id: 'type-poem', labelKey: 'popup_followup_chip_poem', value: 'poem' }
  ]
}

function suggestionsForSlot(slot: RecallFollowUpSlot | null): RecallFollowUpSuggestionSpec[] {
  switch (slot) {
    case 'time':
      return TIME_SUGGESTIONS
    case 'objectType':
      return objectTypeSuggestions()
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
        { id: 'note', labelKey: 'popup_suggest_note', value: 'my note' }
      ]
  }
}

export type BuildRecallFollowUpPlanOptions = {
  /** no_match 细分；constrained_none 走事实空态文案 */
  emptyKind?: RecallEmptyKind
  /** 是否挂了最近同类猜测卡（影响文案 key） */
  hasRelatedGuess?: boolean
}

/**
 * 为 need_a_clue / no_match 生成追问计划。
 * top_pick 不调用本函数。
 */
export function buildRecallFollowUpPlan(
  parsed: ParsedRecallClue,
  outcome: Extract<RecallOutcome, 'need_a_clue' | 'no_match'>,
  options: BuildRecallFollowUpPlanOptions = {}
): RecallFollowUpPlan {
  const missingSlots = listMissingRecallSlots(parsed)

  // 约束下库空：诚实事实 + 仅「换时间」域内芯片；禁止再问类型/全局问卷
  if (outcome === 'no_match' && options.emptyKind === 'constrained_none') {
    return {
      replyKey: options.hasRelatedGuess
        ? 'popup_followup_miss_constrained_empty_with_guess'
        : 'popup_followup_miss_constrained_empty',
      missingSlots,
      primarySlot: 'time',
      suggestions: TIME_SUGGESTIONS
    }
  }

  // 已有内容词时，优先追问时间/类型，而不是再要内容
  let askable =
    parsed.contentTerms.length > 0 ? missingSlots.filter(slot => slot !== 'content') : missingSlots

  // 已解析出对象类型 → 永不追问类型（防「电影」后再问文章/诗/歌）
  if (parsed.objectTypes && parsed.objectTypes.length > 0) {
    askable = askable.filter(slot => slot !== 'objectType')
  }

  // 已有时间+类型仍 miss：优先补内容词，不要回退成类型问卷
  if (
    outcome === 'no_match' &&
    parsed.timeRange &&
    parsed.objectTypes &&
    parsed.objectTypes.length > 0
  ) {
    askable = askable.filter(slot => slot === 'content' || slot === 'note')
  }

  const primarySlot = pickPrimaryFollowUpSlot(askable.length > 0 ? askable : [])

  return {
    replyKey: replyKeyFor(outcome, primarySlot),
    missingSlots,
    primarySlot,
    suggestions: suggestionsForSlot(primarySlot)
  }
}
