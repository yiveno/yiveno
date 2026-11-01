/**
 * 理解回声：把合并后 Parsed 槽位压成可扫芯片（§7.0）。
 * 只露真实闭集槽位 + 线索字面 token；禁止 Thinking / 编造主题。
 * 可纠错切片：类型/时间 Replace；内容词 Exclude（行为/附注本切片只读）。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type { RecallRelativeTimeLabel } from '@/core/recall/parse-recall-clue-lexicon'
import type {
  ParsedRecallClue,
  RecallBehaviorHint,
  RecallObjectType
} from '@/core/recall/parse-recall-clue-types'
import type { RecallFramingUnderstood } from '@/core/recall/recall-framing-facts'

const OBJECT_TYPE_LABEL_KEYS: Record<RecallObjectType, string> = {
  poem: 'framing_object_poem',
  article: 'framing_object_article',
  song: 'framing_object_song',
  video: 'framing_object_video',
  code: 'framing_object_code',
  command: 'framing_object_command',
  page: 'framing_object_page',
  password: 'framing_object_password',
  quote: 'framing_object_quote',
  bookmark: 'framing_object_bookmark'
}

const TIME_LABEL_MESSAGE_KEYS: Record<RecallRelativeTimeLabel, string> = {
  today: 'framing_time_today',
  yesterday: 'framing_time_yesterday',
  day_before_yesterday: 'framing_time_day_before_yesterday',
  last_week: 'framing_time_last_week',
  recent: 'framing_time_recent',
  a_while_ago: 'framing_time_a_while_ago',
  last_month: 'framing_time_last_month',
  few_months_ago: 'framing_time_few_months_ago',
  long_ago: 'framing_time_long_ago'
}

const BEHAVIOR_LABEL_KEYS: Record<RecallBehaviorHint, string> = {
  half_read: 'popup_recall_echo_behavior_half_read',
  often_opened: 'popup_recall_echo_behavior_often_opened',
  recently_saved: 'popup_recall_echo_behavior_recently_saved'
}

/** 内容词芯片上限（其余留给气泡 Framing / 用户续打）。 */
const MAX_CONTENT_TERM_CHIPS = 3

/** 回声芯片槽位种类（闭集）。 */
export type RecallUnderstandingEchoChipKind =
  | 'object_type' // 对象类型
  | 'time' // 相对时间
  | 'behavior' // 行为提示（本切片只读）
  | 'note' // 附注指向（本切片只读）
  | 'content_term' // 内容词

/**
 * 理解回声芯片模型。
 * `correctable`：本切片可点开纠错菜单（类型/时间换槽；内容词排除）。
 */
export type RecallUnderstandingEchoChip = {
  id: string
  kind: RecallUnderstandingEchoChipKind
  label: string
  correctable: boolean
  objectType?: RecallObjectType
  timeLabel?: RecallRelativeTimeLabel
  contentTerm?: string
}

export type RecallUnderstandingEchoSource = Pick<
  RecallFramingUnderstood,
  'objectTypes' | 'contentTerms' | 'behaviorHints' | 'noteHint'
> & {
  timeLabel?: string
  timeConfidence?: 'high' | 'low'
}

/** 对象类型 → i18n key（纠错菜单复用）。 */
export function recallObjectTypeLabelKey(type: RecallObjectType): string {
  return OBJECT_TYPE_LABEL_KEYS[type]
}

/** 相对时间 label → i18n key（纠错菜单复用）。 */
export function recallTimeLabelMessageKey(label: RecallRelativeTimeLabel): string {
  return TIME_LABEL_MESSAGE_KEYS[label]
}

/** 从 Parsed 抽回声源；无有意义槽位时返回 null。 */
export function recallUnderstandingEchoSourceFromParsed(
  parsed: ParsedRecallClue | null | undefined
): RecallUnderstandingEchoSource | null {
  if (!parsed) {
    return null
  }
  return {
    objectTypes: parsed.objectTypes ?? [],
    contentTerms: parsed.contentTerms ?? [],
    behaviorHints: parsed.behaviorHints ?? [],
    noteHint: parsed.noteHint === true,
    ...(parsed.timeRange?.label ? { timeLabel: parsed.timeRange.label } : {}),
    ...(parsed.timeConfidence ? { timeConfidence: parsed.timeConfidence } : {})
  }
}

/**
 * 生成用户可见芯片模型（已翻译 label）。
 * 顺序：类型 → 时间 → 行为 → 附注 → 内容词。
 */
export function formatRecallUnderstandingEchoChips(
  source: RecallUnderstandingEchoSource,
  translate: TranslateFn
): RecallUnderstandingEchoChip[] {
  const chips: RecallUnderstandingEchoChip[] = []

  for (const type of source.objectTypes) {
    const key = OBJECT_TYPE_LABEL_KEYS[type as RecallObjectType]
    if (!key) {
      continue
    }
    chips.push({
      id: `object_type:${type}`,
      kind: 'object_type',
      label: translate(key),
      correctable: true,
      objectType: type as RecallObjectType
    })
  }

  if (source.timeLabel) {
    const timeKey = TIME_LABEL_MESSAGE_KEYS[source.timeLabel as RecallRelativeTimeLabel]
    const timePhrase = timeKey ? translate(timeKey) : source.timeLabel.split('_').join(' ')
    const label =
      source.timeConfidence === 'low'
        ? translate('popup_recall_echo_time_soft', [timePhrase])
        : timePhrase
    chips.push({
      id: `time:${source.timeLabel}`,
      kind: 'time',
      label,
      correctable: Boolean(timeKey),
      ...(timeKey ? { timeLabel: source.timeLabel as RecallRelativeTimeLabel } : {})
    })
  }

  for (const hint of source.behaviorHints) {
    const key = BEHAVIOR_LABEL_KEYS[hint as RecallBehaviorHint]
    if (!key) {
      continue
    }
    chips.push({
      id: `behavior:${hint}`,
      kind: 'behavior',
      label: translate(key),
      correctable: false
    })
  }

  if (source.noteHint) {
    chips.push({
      id: 'note',
      kind: 'note',
      label: translate('popup_recall_echo_note'),
      correctable: false
    })
  }

  for (const term of source.contentTerms.slice(0, MAX_CONTENT_TERM_CHIPS)) {
    const trimmed = term.trim()
    if (!trimmed) {
      continue
    }
    chips.push({
      id: `content_term:${trimmed.toLowerCase()}`,
      kind: 'content_term',
      label: translate('popup_recall_echo_term', [trimmed]),
      correctable: true,
      contentTerm: trimmed
    })
  }

  return chips
}
