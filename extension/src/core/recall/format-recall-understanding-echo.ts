/**
 * 理解回声：把合并后 Parsed 槽位压成可扫芯片标签（§7.0）。
 * 只露真实闭集槽位 + 线索字面 token；禁止 Thinking / 编造主题。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type { ParsedRecallClue, RecallBehaviorHint } from '@/core/recall/parse-recall-clue-types'
import type { RecallFramingUnderstood } from '@/core/recall/recall-framing-facts'

const OBJECT_TYPE_LABEL_KEYS: Record<string, string> = {
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

const TIME_LABEL_MESSAGE_KEYS: Record<string, string> = {
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

export type RecallUnderstandingEchoSource = Pick<
  RecallFramingUnderstood,
  'objectTypes' | 'contentTerms' | 'behaviorHints' | 'noteHint'
> & {
  timeLabel?: string
  timeConfidence?: 'high' | 'low'
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
 * 生成用户可见芯片（已翻译）。
 * 顺序：类型 → 时间 → 行为 → 附注 → 内容词。
 */
export function formatRecallUnderstandingEchoChips(
  source: RecallUnderstandingEchoSource,
  translate: TranslateFn
): string[] {
  const chips: string[] = []

  for (const type of source.objectTypes) {
    const key = OBJECT_TYPE_LABEL_KEYS[type]
    if (key) {
      chips.push(translate(key))
    }
  }

  if (source.timeLabel) {
    const timeKey = TIME_LABEL_MESSAGE_KEYS[source.timeLabel]
    const timePhrase = timeKey ? translate(timeKey) : source.timeLabel.split('_').join(' ')
    chips.push(
      source.timeConfidence === 'low'
        ? translate('popup_recall_echo_time_soft', [timePhrase])
        : timePhrase
    )
  }

  for (const hint of source.behaviorHints) {
    const key = BEHAVIOR_LABEL_KEYS[hint as RecallBehaviorHint]
    if (key) {
      chips.push(translate(key))
    }
  }

  if (source.noteHint) {
    chips.push(translate('popup_recall_echo_note'))
  }

  for (const term of source.contentTerms.slice(0, MAX_CONTENT_TERM_CHIPS)) {
    const trimmed = term.trim()
    if (trimmed) {
      chips.push(translate('popup_recall_echo_term', [trimmed]))
    }
  }

  return chips
}
