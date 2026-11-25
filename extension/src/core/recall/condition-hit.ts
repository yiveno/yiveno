/**
 * 条件 ↔ 候选命中判定（供 applyConditionBoosts）。
 * 纯函数；不改可信度分数。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { ScoredCondition } from '@/core/recall/condition-credibility'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  memoryItemInTimeRange,
  memoryItemMatchesObjectType
} from '@/core/recall/orchestrate-keyword-recall'
import type { RecallRelativeTimeLabel } from '@/core/recall/parse-recall-clue-lexicon'
import { resolveRelativeTimeRange } from '@/core/recall/parse-recall-clue'
import type { RecallObjectType, RecallTimeRange } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '@/core/recall/recall-result'

const RELATIVE_TIME_LABELS = new Set<string>([
  'today',
  'yesterday',
  'day_before_yesterday',
  'last_week',
  'recent',
  'a_while_ago',
  'last_month',
  'few_months_ago',
  'long_ago'
])

function resolveConditionTimeRange(label: string, nowMs: number): RecallTimeRange | null {
  if (!RELATIVE_TIME_LABELS.has(label)) {
    return null
  }
  return resolveRelativeTimeRange(label as RecallRelativeTimeLabel, nowMs)
}

/** 条目可检索文本（标题 / 摘录 / 附注 / URL）。 */
function memoryItemSearchBlob(item: MemoryItem): string {
  const parts: string[] = []
  if (item.type === 'bookmark') {
    parts.push(item.payload.title, item.payload.url, item.payload.domain)
  } else {
    parts.push(
      item.payload.selectedText,
      item.payload.pageTitle,
      item.payload.sourceUrl,
      item.payload.domain
    )
  }
  parts.push(item.clues.note ?? '')
  for (const tag of item.clues.tags ?? []) {
    parts.push(tag)
  }
  for (const kw of item.clues.keywords ?? []) {
    parts.push(kw)
  }
  return normalizeRecallText(parts.filter(Boolean).join('\n'))
}

/** contentTerm 是否命中条目词面。 */
function contentTermHitsItem(item: MemoryItem, term: string): boolean {
  const normalized = normalizeRecallText(term)
  if (!normalized) {
    return false
  }
  return memoryItemSearchBlob(item).includes(normalized)
}

/**
 * 条件是否命中候选。
 * preferenceOperator 不在 Hybrid 条目上判命中（行为路径独立；本函数恒 false）。
 */
export function conditionHitsMemoryItem(
  item: MemoryItem,
  condition: ScoredCondition,
  options: { nowMs?: number; timeRange?: RecallTimeRange } = {}
): boolean {
  if (condition.active === false) {
    return false
  }
  switch (condition.slot) {
    case 'contentTerm':
      return contentTermHitsItem(item, condition.value)
    case 'objectType':
      return memoryItemMatchesObjectType(item, condition.value as RecallObjectType)
    case 'timeRange': {
      const range =
        options.timeRange ?? resolveConditionTimeRange(condition.value, options.nowMs ?? Date.now())
      return range ? memoryItemInTimeRange(item, range) : false
    }
    case 'preferenceOperator':
      return false
    default:
      return false
  }
}

/** RecallMatch 包装。 */
export function conditionHitsRecallMatch(
  match: RecallMatch,
  condition: ScoredCondition,
  options: { nowMs?: number; timeRange?: RecallTimeRange } = {}
): boolean {
  return conditionHitsMemoryItem(match.item, condition, options)
}
