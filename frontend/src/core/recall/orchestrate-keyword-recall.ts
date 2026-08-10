/**
 * P0 关键词 Recall 编排：口语解析 → 检索词选择 → 约束软加权 → 折叠出结果。
 * 不改变 Filter 内核；只在候选分上叠加时间/类型/备注/行为信号。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_MATCH_FETCH_LIMIT,
  RECALL_RESULT_SLOT_LIMIT,
  buildRecallResult
} from '@/core/recall/build-recall-result'
import { collapseRecallMatches } from '@/core/recall/collapse-recall-duplicates'
import {
  compactRecallText,
  filterMemoryItemsByKeyword,
  normalizeRecallText
} from '@/core/recall/keyword-filter'
import { expandRecallContentTerms } from '@/core/memory/memory-topic-lexicon'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import {
  RECALL_OBJECT_TYPE_CANONICAL_SURFACES,
  RECALL_OBJECT_TYPE_LEXICON
} from '@/core/recall/parse-recall-clue-lexicon'
import type {
  ParsedRecallClue,
  RecallObjectType,
  RecallTimeRange
} from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

/** 对象类型命中软加成。 */
export const RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST = 8

/** 备注指向且条目有 note 时的软加成。 */
export const RECALL_ORCHESTRATION_NOTE_HINT_BOOST = 6

/** often_opened 且 openCount 较高时的软加成。 */
export const RECALL_ORCHESTRATION_OFTEN_OPENED_BOOST = 4

/** recently_saved：近 7 天内创建的软加成。 */
export const RECALL_ORCHESTRATION_RECENTLY_SAVED_BOOST = 5

/** half_read：摘录类或低 openCount 书签的软加成。 */
export const RECALL_ORCHESTRATION_HALF_READ_BOOST = 3

const OFTEN_OPENED_MIN_COUNT = 3
const RECENTLY_SAVED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export interface OrchestrateKeywordRecallOptions {
  candidateLimit?: number
  nowMs?: number
  /** 预解析结果；提供则跳过内部 parseRecallClue（供理解层注入）。 */
  parsed?: ParsedRecallClue
}

/** 对象类型 → 词典词面（用于条目文本弱匹配与无 contentTerms 时的回退检索）。 */
const OBJECT_TYPE_SURFACES = (() => {
  const map = new Map<RecallObjectType, string[]>()
  for (const entry of RECALL_OBJECT_TYPE_LEXICON) {
    const list = map.get(entry.value) ?? []
    list.push(normalizeRecallText(entry.surface))
    map.set(entry.value, list)
  }
  return map
})()

/** 由解析结果决定交给 keyword-filter 的检索串。 */
export function buildSearchClueFromParsed(parsed: ParsedRecallClue): string {
  if (parsed.contentTerms.length > 0) {
    return expandRecallContentTerms(parsed.contentTerms).join(' ')
  }

  if (parsed.objectTypes && parsed.objectTypes.length > 0) {
    const preferred = parsed.objectTypes
      .map(type => RECALL_OBJECT_TYPE_CANONICAL_SURFACES[type])
      .filter((value): value is string => Boolean(value))
    if (preferred.length > 0) {
      return preferred.join(' ')
    }
  }

  return parsed.raw
}

function parseIsoMs(value: string | undefined | null): number | null {
  if (!value) {
    return null
  }
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/** createdAt 是否落在时间窗内。 */
export function memoryItemInTimeRange(item: MemoryItem, timeRange: RecallTimeRange): boolean {
  const fromMs = Date.parse(timeRange.from)
  const toMs = Date.parse(timeRange.to)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return false
  }

  const candidates = [item.createdAt, item.clues.lastOpenedAt]
  for (const value of candidates) {
    const ms = parseIsoMs(value)
    if (ms !== null && ms >= fromMs && ms <= toMs) {
      return true
    }
  }
  return false
}

/**
 * 有 timeRange 时硬排除窗外命中（产品：时间约束须生效，不能只靠软加权）。
 * 无 timeRange 时原样返回。
 */
export function filterMatchesByParsedTimeRange(
  matches: RecallMatch[],
  parsed: ParsedRecallClue
): RecallMatch[] {
  if (!parsed.timeRange) {
    return matches
  }
  const range = parsed.timeRange
  return matches.filter(match => memoryItemInTimeRange(match.item, range))
}

function collectItemMatchBlob(item: MemoryItem): string {
  const { clues } = item
  const parts = [
    clues.title,
    clues.textExcerpt,
    clues.summary,
    clues.note,
    clues.domain,
    ...clues.keywords,
    ...clues.tags,
    ...clues.entities,
    ...(item.type === 'bookmark'
      ? [item.payload.title, item.payload.url, item.payload.domain]
      : [item.payload.selectedText, item.payload.pageTitle, item.payload.sourceUrl])
  ].filter((value): value is string => Boolean(value))

  return compactRecallText(parts.join(' '))
}

/** 条目是否像指定对象类型（tags slug 或正文含类型词面）。 */
export function memoryItemMatchesObjectType(
  item: MemoryItem,
  objectType: RecallObjectType
): boolean {
  const tags = item.clues.tags.map(tag => normalizeRecallText(tag))
  if (tags.includes(objectType)) {
    return true
  }

  const blob = collectItemMatchBlob(item)
  const surfaces = OBJECT_TYPE_SURFACES.get(objectType) ?? []
  return surfaces.some(surface => surface.length > 0 && blob.includes(compactRecallText(surface)))
}

/** 在已有词面分上叠加结构化软加权（无词面命中不加）。时间已硬过滤，不再软加成。 */
export function applyParsedClueScoreBoosts(
  match: RecallMatch,
  parsed: ParsedRecallClue
): RecallMatch {
  if (match.score <= 0) {
    return match
  }

  let boost = 0

  if (parsed.objectTypes?.some(type => memoryItemMatchesObjectType(match.item, type))) {
    boost += RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST
  }

  if (parsed.noteHint && match.item.clues.note?.trim()) {
    boost += RECALL_ORCHESTRATION_NOTE_HINT_BOOST
  }

  if (
    parsed.behaviorHints?.includes('often_opened') &&
    (match.item.clues.openCount ?? 0) >= OFTEN_OPENED_MIN_COUNT
  ) {
    boost += RECALL_ORCHESTRATION_OFTEN_OPENED_BOOST
  }

  if (parsed.behaviorHints?.includes('recently_saved')) {
    const createdMs = parseIsoMs(match.item.createdAt)
    const nowMs = Date.now()
    if (createdMs !== null && nowMs - createdMs <= RECENTLY_SAVED_WINDOW_MS) {
      boost += RECALL_ORCHESTRATION_RECENTLY_SAVED_BOOST
    }
  }

  if (parsed.behaviorHints?.includes('half_read')) {
    const openCount = match.item.clues.openCount ?? 0
    if (match.item.type === 'text_excerpt' || openCount <= 1) {
      boost += RECALL_ORCHESTRATION_HALF_READ_BOOST
    }
  }

  if (boost === 0) {
    return match
  }

  return {
    ...match,
    score: match.score + boost
  }
}

/**
 * 带口语解析的关键词 Recall。
 * RecallResult.clue 仍为用户原始输入（UI 展示）；内部检索可用剥离后的 searchClue。
 */
export function recallByKeywordWithParsedClue(
  items: MemoryItem[],
  clue: string,
  options: OrchestrateKeywordRecallOptions = {}
): RecallResult {
  const raw = clue.trim()
  if (!raw) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      clue: ''
    }
  }

  const nowMs = options.nowMs ?? Date.now()
  const parsed = options.parsed ?? parseRecallClue(raw, { nowMs })
  const searchClue = buildSearchClueFromParsed(parsed)
  const slotLimit = options.candidateLimit ?? RECALL_RESULT_SLOT_LIMIT

  const matches = filterMatchesByParsedTimeRange(
    filterMemoryItemsByKeyword(items, searchClue, {
      limit: RECALL_MATCH_FETCH_LIMIT,
      nowMs
    }).map(match => applyParsedClueScoreBoosts(match, parsed)),
    parsed
  )

  matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })

  const collapsed = collapseRecallMatches(matches, {
    limit: slotLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  return buildRecallResult(raw, collapsed)
}
