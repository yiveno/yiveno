/**
 * 将 RecallFramingFacts 渲染为助手气泡静态文案（P1→P6 优先级）。
 */
import type { TranslateFn } from '@/core/i18n/translate'
import type {
  RecallFramingBucket,
  RecallFramingFacts,
  RecallFramingRetrievalPath,
  RecallFramingUnderstood
} from '@/core/recall/recall-framing-facts'

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

/** 内部 timeLabel → 用户可见美式英语短语（经 i18n；禁止把 snake_case 原样露出）。 */
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

function joinSentences(parts: string[]): string {
  return parts.filter(part => part.trim().length > 0).join(' ')
}

/** 拼接 Framing 句子（LLM 润色后与 P6 计数拼接）。 */
export function joinRecallFramingSentences(parts: string[]): string {
  return joinSentences(parts)
}

function renderUnderstood(understood: RecallFramingUnderstood, translate: TranslateFn): string {
  const segments: string[] = []

  if (understood.objectTypes.length > 0) {
    const labels = understood.objectTypes.map(type =>
      translate(OBJECT_TYPE_LABEL_KEYS[type] ?? 'framing_object_generic', [type])
    )
    segments.push(
      translate('framing_p1_object_types', [labels.join(translate('framing_list_sep'))])
    )
  }

  if (understood.timeLabel) {
    const timeKey = TIME_LABEL_MESSAGE_KEYS[understood.timeLabel]
    const timePhrase = timeKey ? translate(timeKey) : understood.timeLabel.split('_').join(' ')
    const timeFrameKey =
      understood.timeConfidence === 'low' ? 'framing_p1_time_soft' : 'framing_p1_time'
    segments.push(translate(timeFrameKey, [timePhrase]))
  }

  if (understood.contentTerms.length > 0) {
    const terms = understood.contentTerms.slice(0, 3).join(translate('framing_list_sep'))
    segments.push(translate('framing_p1_terms', [terms]))
  } else if (segments.length === 0) {
    segments.push(translate('framing_p1_generic'))
  }

  if (understood.noteHint) {
    segments.push(translate('framing_p1_note_hint'))
  }

  return segments.join(' ')
}

function renderRetrievalPath(path: RecallFramingRetrievalPath, translate: TranslateFn): string {
  const keyByPath: Record<RecallFramingRetrievalPath, string> = {
    literal: 'framing_p2_literal',
    constraint_neighborhood: 'framing_p2_constraint',
    hybrid: 'framing_p2_hybrid',
    mixed: 'framing_p2_mixed'
  }
  return translate(keyByPath[path])
}

function renderBucket(bucket: RecallFramingBucket, translate: TranslateFn): string {
  if (bucket.labelKey === 'framing_bucket_domain' && bucket.domain) {
    return translate(bucket.labelKey, [bucket.domain, String(bucket.count)])
  }
  return translate(bucket.labelKey, [String(bucket.count)])
}

function renderBuckets(buckets: RecallFramingBucket[], translate: TranslateFn): string {
  if (buckets.length === 0) {
    return ''
  }
  const labels = buckets.map(bucket => renderBucket(bucket, translate))
  return translate('framing_p3_prefix', [labels.join(translate('framing_list_sep'))])
}

function renderStance(
  stance: 'confident_neighborhood' | 'weak_candidates',
  translate: TranslateFn
): string {
  return translate(stance === 'confident_neighborhood' ? 'framing_p4_confident' : 'framing_p4_weak')
}

function renderAmbiguity(promptKey: string, translate: TranslateFn, objectType?: string): string {
  if (promptKey === 'framing_ambiguity_type_mix' && objectType) {
    const typeLabel = translate(OBJECT_TYPE_LABEL_KEYS[objectType] ?? 'framing_object_generic', [
      objectType
    ])
    return translate(promptKey, [typeLabel])
  }
  return translate(promptKey)
}

function renderCounts(total: number, shown: number, translate: TranslateFn): string {
  if (total <= 0) {
    return ''
  }
  if (shown >= total) {
    return translate('framing_p6_all', [String(total)])
  }
  return translate('framing_p6_partial', [String(total), '1', String(shown)])
}

/** P6：仅计数句（LLM 润色后 deterministic 拼接）。 */
export function renderRecallFramingCounts(
  facts: RecallFramingFacts,
  translate: TranslateFn
): string {
  if (facts.kind !== 'candidates') {
    return ''
  }
  return renderCounts(facts.counts.total, facts.counts.shown, translate)
}

/** P1–P5 规则正文（不含 P6 计数）。 */
export function renderRecallFramingRulesBody(
  facts: RecallFramingFacts,
  translate: TranslateFn
): string {
  if (facts.kind === 'guess') {
    const parts = [
      renderUnderstood(facts.understood, translate),
      translate(
        facts.emptyKind === 'constrained_none'
          ? 'framing_guess_constrained_none'
          : 'framing_guess_unconstrained'
      ),
      translate('framing_guess_disclaimer')
    ]
    return joinSentences(parts)
  }

  const parts: string[] = [
    renderUnderstood(facts.understood, translate),
    renderRetrievalPath(facts.retrievalPath, translate),
    renderBuckets(facts.buckets, translate),
    renderStance(facts.stance, translate)
  ]

  if (facts.ambiguity) {
    parts.push(renderAmbiguity(facts.ambiguity.promptKey, translate, facts.ambiguity.objectType))
  }

  return joinSentences(parts)
}

/** 将 Framing 事实渲染为单段气泡文案。 */
export function renderRecallFraming(facts: RecallFramingFacts, translate: TranslateFn): string {
  if (facts.kind === 'guess') {
    return renderRecallFramingRulesBody(facts, translate)
  }

  return joinSentences([
    renderRecallFramingRulesBody(facts, translate),
    renderRecallFramingCounts(facts, translate)
  ])
}
