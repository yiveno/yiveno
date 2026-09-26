/**
 * no_match 后判定「约束下库空」并可选挂载最近同类猜测（真实 MemoryItem）。
 * 不改 Filter 内核；只补充 emptyKind / relatedGuess。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  hasRecallTopicAnchor,
  memoryItemInTimeRange,
  memoryItemMatchesObjectType
} from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

/** 强约束：至少时间窗 + 对象类型（产品文档 §7.0 约束下库空）。 */
export function hasStrongRecallConstraints(parsed: ParsedRecallClue): boolean {
  return Boolean(parsed.timeRange && parsed.objectTypes && parsed.objectTypes.length > 0)
}

function itemRecencyMs(item: MemoryItem): number {
  if (item.type === 'bookmark' && item.payload.chromeCreatedAt) {
    const chromeMs = Date.parse(item.payload.chromeCreatedAt)
    if (!Number.isNaN(chromeMs)) {
      return chromeMs
    }
  }
  const updated = Date.parse(item.updatedAt)
  if (!Number.isNaN(updated)) {
    return updated
  }
  const created = Date.parse(item.createdAt)
  return Number.isNaN(created) ? 0 : created
}

/** 库内是否存在同时满足时间窗与对象类型的痕迹。 */
export function hasConstrainedMemoryHit(items: MemoryItem[], parsed: ParsedRecallClue): boolean {
  if (!parsed.timeRange || !parsed.objectTypes || parsed.objectTypes.length === 0) {
    return false
  }
  const types = parsed.objectTypes
  return items.some(
    item =>
      memoryItemInTimeRange(item, parsed.timeRange!) &&
      types.some(type => memoryItemMatchesObjectType(item, type))
  )
}

/**
 * 最近一条同类痕迹（忽略时间窗）；优先窗外，否则取库内最新同类。
 * 无真实条目时返回 null（禁止编造）。
 */
export function findRelatedGuessMatch(
  items: MemoryItem[],
  parsed: ParsedRecallClue
): RecallMatch | null {
  const types = parsed.objectTypes
  if (!types || types.length === 0) {
    return null
  }

  const sameType = items.filter(item => types.some(type => memoryItemMatchesObjectType(item, type)))
  if (sameType.length === 0) {
    return null
  }

  const timeRange = parsed.timeRange
  const outsideWindow =
    timeRange === undefined
      ? sameType
      : sameType.filter(item => !memoryItemInTimeRange(item, timeRange))

  const pool = outsideWindow.length > 0 ? outsideWindow : sameType
  const best = [...pool].sort((left, right) => itemRecencyMs(right) - itemRecencyMs(left))[0]
  if (!best) {
    return null
  }

  return {
    item: best,
    score: 0,
    matchedFields: ['related_guess']
  }
}

/**
 * 为 no_match 结果挂上 emptyKind；强约束且窗内无同类时挂 relatedGuess。
 */
export function enrichEmptyRecallResult(
  result: RecallResult,
  items: MemoryItem[],
  parsed: ParsedRecallClue
): RecallResult {
  if (result.outcome !== 'no_match') {
    return result
  }

  // H-topic 主题必填：无主题锚直接标缺主题，不进约束判定，不挂猜测。
  if (!hasRecallTopicAnchor(parsed)) {
    return {
      ...result,
      emptyKind: 'missing_topic',
      relatedGuess: null
    }
  }

  if (!hasStrongRecallConstraints(parsed)) {
    return {
      ...result,
      emptyKind: 'unconstrained',
      relatedGuess: null
    }
  }

  if (hasConstrainedMemoryHit(items, parsed)) {
    // 强约束下其实有条目，但本轮 Filter 未命中 → 仍当模糊空，避免误报「库空」
    return {
      ...result,
      emptyKind: 'unconstrained',
      relatedGuess: null
    }
  }

  return {
    ...result,
    emptyKind: 'constrained_none',
    relatedGuess: findRelatedGuessMatch(items, parsed)
  }
}
