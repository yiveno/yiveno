/**
 * P0 关键词 Recall 编排：口语解析 → 检索词选择 → 约束软加权 → 折叠出结果。
 * 不改变 Filter 内核；只在候选分上叠加时间/类型/备注/行为信号。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_RESULT_POOL_LIMIT,
  buildRecallResult,
  filterKeywordMatchesBeforeCollapse
} from '@/core/recall/build-recall-result'
import { collapseRecallMatches } from '@/core/recall/collapse-recall-duplicates'
import {
  compactRecallText,
  normalizeRecallText,
  RECALL_TOP_PICK_MIN_SCORE
} from '@/core/recall/keyword-filter'
import { parseRecallClue, resolveRelativeTimeRange } from '@/core/recall/parse-recall-clue'
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

/** often_opened 且 settledCount 较高时的软加成（§7.2：不吃裸 openCount）。 */
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

/** 由解析结果决定交给 keyword-filter 的检索串（不做内容别名扩词）。 */
export function buildSearchClueFromParsed(parsed: ParsedRecallClue): string {
  if (parsed.contentTerms.length > 0) {
    return parsed.contentTerms.join(' ')
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

/** 条目「收藏/保存」时刻：书签优先 Chrome dateAdded，否则 createdAt。 */
export function memoryItemSavedAtMs(item: MemoryItem): number | null {
  if (item.type === 'bookmark') {
    const chromeMs = parseIsoMs(item.payload.chromeCreatedAt)
    if (chromeMs !== null) {
      return chromeMs
    }
  }
  return parseIsoMs(item.createdAt)
}

/** createdAt / chromeCreatedAt / lastOpenedAt 是否落在时间窗内。 */
export function memoryItemInTimeRange(item: MemoryItem, timeRange: RecallTimeRange): boolean {
  const fromMs = Date.parse(timeRange.from)
  const toMs = Date.parse(timeRange.to)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return false
  }

  const candidates = [
    item.createdAt,
    item.clues.lastOpenedAt,
    item.type === 'bookmark' ? item.payload.chromeCreatedAt : undefined
  ]
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
  // bookmark 是语料源类型：直接对齐 MemoryItem.type，不依赖标题里出现 "bookmark"
  if (objectType === 'bookmark') {
    return item.type === 'bookmark'
  }

  const tags = item.clues.tags.map(tag => normalizeRecallText(tag))
  if (tags.includes(objectType)) {
    return true
  }

  const blob = collectItemMatchBlob(item)
  const surfaces = OBJECT_TYPE_SURFACES.get(objectType) ?? []
  return surfaces.some(surface => surface.length > 0 && blob.includes(compactRecallText(surface)))
}

/**
 * 无内容词 + 时间/刚存/类型约束：按近因列邻域，禁止把虚词当关键词扫库。
 * 产品：用户忘了标题才开口；「just saved」「recently collected bookmark」均须出邻域。
 */
export function shouldRecallByConstraintNeighborhood(parsed: ParsedRecallClue): boolean {
  if (parsed.contentTerms.length > 0) {
    return false
  }
  const hasType = Boolean(parsed.objectTypes && parsed.objectTypes.length > 0)
  const hasRecentSaved = Boolean(parsed.behaviorHints?.includes('recently_saved'))
  const hasTime = Boolean(parsed.timeRange)
  // 仅「just saved」也成立：不要求再说 bookmark / article
  return hasRecentSaved || hasTime || hasType
}

/** recently_saved 且无线性时间词时，视为 recent 窗。 */
export function effectiveParsedTimeRange(
  parsed: ParsedRecallClue,
  nowMs: number
): RecallTimeRange | undefined {
  if (parsed.timeRange) {
    return parsed.timeRange
  }
  if (parsed.behaviorHints?.includes('recently_saved')) {
    return resolveRelativeTimeRange('recent', nowMs)
  }
  return undefined
}

function itemCreatedMs(item: MemoryItem): number {
  return memoryItemSavedAtMs(item) ?? 0
}

/**
 * 约束邻域：时间窗硬过滤 + 可选类型过滤，按 createdAt 近因打分。
 * 最新一条须达 Top Pick 阈值（建议，非神谕）。
 */
export function recallMatchesByConstraintNeighborhood(
  items: MemoryItem[],
  parsed: ParsedRecallClue,
  nowMs: number
): RecallMatch[] {
  const range = effectiveParsedTimeRange(parsed, nowMs)
  const types = parsed.objectTypes

  let pool = items
  if (range) {
    pool = pool.filter(item => memoryItemInTimeRange(item, range))
  }
  if (types && types.length > 0) {
    pool = pool.filter(item => types.some(type => memoryItemMatchesObjectType(item, type)))
  }

  if (pool.length === 0) {
    return []
  }

  const ranked = [...pool].sort((left, right) => itemCreatedMs(right) - itemCreatedMs(left))
  const newestMs = itemCreatedMs(ranked[0]!)

  return ranked.map((item, index) => {
    const ageGapDays = Math.max(0, (newestMs - itemCreatedMs(item)) / (24 * 60 * 60 * 1000))
    // 最新 = Top Pick 门槛；越旧分越低，仍可进 Also Possible
    const score = Math.max(1, RECALL_TOP_PICK_MIN_SCORE - index - Math.floor(ageGapDays))
    return {
      item,
      score,
      matchedFields: ['constraint_neighborhood']
    }
  })
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
    (match.item.clues.settledCount ?? 0) >= OFTEN_OPENED_MIN_COUNT
  ) {
    boost += RECALL_ORCHESTRATION_OFTEN_OPENED_BOOST
  }

  if (parsed.behaviorHints?.includes('recently_saved')) {
    const savedMs = memoryItemSavedAtMs(match.item)
    const nowMs = Date.now()
    if (savedMs !== null && nowMs - savedMs <= RECENTLY_SAVED_WINDOW_MS) {
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
 * 无内容词且具备时间+类型（或刚存）时走约束邻域，不把虚词当检索词。
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
      totalRankedCount: 0,
      clue: ''
    }
  }

  const nowMs = options.nowMs ?? Date.now()
  const parsed = options.parsed ?? parseRecallClue(raw, { nowMs })
  const poolLimit = options.candidateLimit ?? RECALL_RESULT_POOL_LIMIT

  if (shouldRecallByConstraintNeighborhood(parsed)) {
    const constraintMatches = recallMatchesByConstraintNeighborhood(items, parsed, nowMs).map(
      match => applyParsedClueScoreBoosts(match, parsed)
    )
    constraintMatches.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return right.item.updatedAt.localeCompare(left.item.updatedAt)
    })
    const collapsed = collapseRecallMatches(constraintMatches, {
      limit: poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
    })
    return buildRecallResult(raw, collapsed)
  }

  const searchClue = buildSearchClueFromParsed(parsed)

  const matches = filterMatchesByParsedTimeRange(
    filterKeywordMatchesBeforeCollapse(items, searchClue, { nowMs }).map(match =>
      applyParsedClueScoreBoosts(match, parsed)
    ),
    parsed
  )

  matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })

  const collapsed = collapseRecallMatches(matches, {
    limit: poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  return buildRecallResult(raw, collapsed)
}
