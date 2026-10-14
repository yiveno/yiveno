/**
 * P0 关键词 Recall 编排：口语解析 → 检索词选择 → 约束软加权 → 折叠出结果。
 * 不改变 Filter 内核；只在候选分上叠加时间/类型/附注/行为信号。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { resolveMemoryItemSavedAtMs } from '@/core/memory/memory-item-saved-at'
import {
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_RESULT_POOL_LIMIT,
  buildRecallResult,
  filterKeywordMatchesBeforeCollapse
} from '@/core/recall/build-recall-result'
import { collapseRecallMatches } from '@/core/recall/collapse-recall-duplicates'
import {
  filterMemoryItemsByKeyword,
  normalizeRecallText,
  RECALL_TOP_PICK_MIN_SCORE,
  type RecallBehaviorProfile
} from '@/core/recall/keyword-filter'
import {
  effectiveContentTermsForRecall,
  filterMatchesByContentTermCorroboration,
  parsedClueForTimeSoftReopen,
  shouldAttemptTimeSoftReopen
} from '@/core/recall/content-term-corroboration'
import { hasRecallTopicAnchor, withRecallTopic } from '@/core/recall/recall-topic'
import { mergeTopicLookupWithKeywordMatches, topicLookup } from '@/core/recall/topic-lookup'
import type { TopicDescriptor } from '@/core/recall/parse-recall-clue-types'
import { TopicDescriptorSchema } from '@/core/recall/parse-recall-clue-types'

import {
  parseRecallClue,
  resolveRelativeTimeRange,
  timeConfidenceForRelativeLabel
} from '@/core/recall/parse-recall-clue'
import {
  RECALL_OBJECT_TYPE_CANONICAL_SURFACES,
  RECALL_OBJECT_TYPE_LEXICON
} from '@/core/recall/parse-recall-clue-lexicon'
import type {
  ParsedRecallClue,
  RecallObjectType,
  RecallTimeConfidence,
  RecallTimeRange
} from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

/** 对象类型命中软加成。 */
export const RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST = 8

/** 附注指向且条目有 note 时的软加成。 */
export const RECALL_ORCHESTRATION_NOTE_HINT_BOOST = 6

/** often_opened 且 settledCount 较高时的软加成（§7.2：不吃裸 openCount）。 */
export const RECALL_ORCHESTRATION_OFTEN_OPENED_BOOST = 4

/** recently_saved：近 7 天内创建的软加成。 */
export const RECALL_ORCHESTRATION_RECENTLY_SAVED_BOOST = 5

/** half_read：摘录类或低 openCount 书签的软加成。 */
export const RECALL_ORCHESTRATION_HALF_READ_BOOST = 3

/** 低置信时间：落在中心窗内的软加成（ADR-011）。 */
export const RECALL_ORCHESTRATION_TIME_SOFT_IN_RANGE_BOOST = 12

/** 约束邻域：低置信窗外条目相对窗内的分差（仍可进邻域）。 */
const CONSTRAINT_OUT_OF_RANGE_SCORE_PENALTY = 20

const OFTEN_OPENED_MIN_COUNT = 3
const RECENTLY_SAVED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export interface OrchestrateKeywordRecallOptions {
  candidateLimit?: number
  nowMs?: number
  /** 预解析结果；提供则跳过内部 parseRecallClue（供理解层注入）。 */
  parsed?: ParsedRecallClue
  /**
   * Indexed Fuzzy 展开词（2026-10-07）。
   * 由 fuzzy-lexicon.ts 预计算字典展开的额外检索词（js→javascript；recat→react）。
   * 仅 Omnibox 模式注入；Side Panel 不使用。
   * 传递到 filterKeywordMatchesBeforeCollapse 做多路合并。
   */
  fuzzyExpandTokens?: readonly string[]
  /**
   * 行为加权档（Omnibox 传 `omnibox`：略抬 open/近因/settled）。
   * Side Panel / 默认不传。
   */
  behaviorProfile?: RecallBehaviorProfile
}

/** 对象类型 → 条目证据词面（跳过 clueOnly；用于 MemoryItem 类型弱匹配）。 */
const OBJECT_TYPE_SURFACES = (() => {
  const map = new Map<RecallObjectType, string[]>()
  for (const entry of RECALL_OBJECT_TYPE_LEXICON) {
    if (entry.clueOnly) {
      continue
    }
    const list = map.get(entry.value) ?? []
    list.push(normalizeRecallText(entry.surface))
    map.set(entry.value, list)
  }
  return map
})()

/**
 * Topic 先验预筛（Gap 1 · P0 候选加载阶段）。
 *
 * 当 parsed.topic 存在时，用 Topic terms（检索词面）对候选池做第一轮预筛，
 * 将命中 Topic 词面的条目加入候选集（与 contentTerms 候选取并集）。
 *
 * 机制：复用现有倒排 Phase 1 同 mechanism（`filterMemoryItemsByKeyword`）。
 * - 仅在 Topic 存在时启用；Topic 未提供时返回原池（不变）
 * - 仅做扩池（并集，不是交集），不让 Topic 删掉现有命中
 * - 不做重排、不做门限——预筛产生的候选池变大，供后续 contentTerms / Hybrid 正常打分
 *
 * @param items 原始候选池（全量或倒排预过滤后）
 * @param topic Topic terms（检索词面）；由 parsed.topic.terms 传入
 * @returns 含 Topic 词面命中的候选集（与原池取并集）
 */
export function filterItemsByTopicTokens(
  items: MemoryItem[],
  topic: { terms: readonly string[] }
): MemoryItem[] {
  const topicTerms = topic.terms
  if (!topicTerms || topicTerms.length === 0) {
    return items
  }

  const filterText = topicTerms.join(' ')
  // 复用现有 keyword-filter 机制，不引入新倒排实现
  const matched = filterMemoryItemsByKeyword(items, filterText, { limit: items.length })
  if (matched.length === 0) {
    return items
  }

  // 取并集：Topic 命中的 + 原池已有的（不删除 contentTerms 已有候选）
  const existingIds = new Set(items.map(item => item.id))
  const extraCandidates = matched.filter(m => !existingIds.has(m.item.id)).map(m => m.item)
  const union = [...items, ...extraCandidates]

  return union
}

/**
 * 由 parsed.topic 构造 RecallResult.topic 字段（窄子集）。
 * 仅在 parsed.topic 存在时填充；Gap 3/5 落地。
 *
 * 注意：不传完整 parsed，只传其 topic 子集——source/strength 等管线内部字段
 * 不对外暴露；tokens 取自 RecallTopic.terms（检索词）。
 * Gap 5：embedding 字段从 parsed.topic.embedding 透传。
 */
function buildTopicDescriptor(topic: NonNullable<ParsedRecallClue['topic']>): TopicDescriptor {
  // displayName = terms 拼接（供 UI Debug 展示）；若无 terms 则用 raw clue 摘要
  const displayName = topic.terms.length > 0 ? topic.terms.join(' ') : '(weak topic)'
  return TopicDescriptorSchema.parse({
    displayName,
    tokens: topic.terms,
    ...(topic.embedding ? { embedding: topic.embedding } : {})
  })
}

/**
 * 给 RecallResult 注入 topic（parsed.topic → TopicDescriptor）。
 * 仅当 parsed.topic 存在时填充；Gap 3 落地。
 */
export function injectTopic(result: RecallResult, parsed: ParsedRecallClue): RecallResult {
  if (!parsed.topic) {
    // 无 topic：topic 字段不出现（严格保持现状不依赖 Topic）
    return result
  }
  return {
    ...result,
    topic: buildTopicDescriptor(parsed.topic)
  }
}

/**
 * 零锚点助手发令词面（闭合产品枚举）：无真实记忆锚时须诚实 no_match，禁止当推荐引擎。
 */
const ASSISTANT_IMPERATIVE_SURFACES = [
  'i feel bored',
  "i'm bored",
  'feel bored',
  'recommend a',
  'recommend me',
  'suggest a',
  'suggest me',
  'pick something',
  'something fun',
  'for me',
  'play some',
  'put on some'
] as const

/**
 * 生活助手 / 非找回意图（闭合产品枚举）。
 * Yiveno 不是天气/点餐/摘要/行程/写码助理；无线索记忆锚时一律诚实空。
 * 须先于「有内容词则放行」判定，否则 summarize/plan/write 会被 LLM 残留词扫库。
 */
const NON_RECALL_LIFE_SURFACES = [
  'what is the weather',
  'whats the weather',
  "what's the weather",
  'weather going to be',
  'weather tomorrow',
  'order me some',
  'order me a',
  'order some pizza',
  'order a pizza',
  'for dinner',
  'what time is it',
  'translate this',
  'write me an email',
  'send an email',
  // 摘要 / 行程规划 / 写码：助手任务，不是找回
  'summarize the',
  'summarize this',
  'summarize latest',
  'summarize for me',
  'plan a trip',
  'plan a weekend',
  'plan me a',
  'write a python',
  'write a script',
  'write me a script',
  'write a program',
  'generate a script',
  'generate code'
] as const

/**
 * 记忆找回锚词面：出现则不作「生活助手」拦截（如「weather article I saved」仍可找回）。
 */
const MEMORY_RECALL_ANCHOR_SURFACES = [
  'saved',
  'bookmarked',
  'bookmark',
  'I noted',
  'i noted',
  'my note',
  'left a note',
  'excerpt',
  'clip I',
  'I highlighted',
  'i highlighted',
  'I bookmarked',
  'i bookmarked',
  'from last',
  'a while ago',
  'few days ago',
  'the other day',
  'I read',
  'i read'
] as const

function isAsciiWordCharForSurface(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9]/.test(char))
}

/** 规范化线索是否含某 surface（ASCII 词边界）。 */
function normalizedClueHasSurface(normalized: string, surface: string): boolean {
  const needle = normalizeRecallText(surface)
  if (!needle) {
    return false
  }
  let fromIndex = 0
  while (fromIndex < normalized.length) {
    const index = normalized.indexOf(needle, fromIndex)
    if (index < 0) {
      return false
    }
    const before = normalized[index - 1]
    const after = normalized[index + needle.length]
    if (!isAsciiWordCharForSurface(before) && !isAsciiWordCharForSurface(after)) {
      return true
    }
    fromIndex = index + 1
  }
  return false
}

function clueHasAnySurface(clue: string, surfaces: readonly string[]): boolean {
  const normalized = normalizeRecallText(clue)
  return surfaces.some(surface => normalizedClueHasSurface(normalized, surface))
}

/** 线索是否含助手发令词面（ASCII 词边界）。 */
export function looksLikeAssistantImperativeClue(clue: string): boolean {
  return clueHasAnySurface(clue, ASSISTANT_IMPERATIVE_SURFACES)
}

/**
 * 生活助手请求（天气/点餐/摘要/行程/写码等）且无线索记忆锚 → 非 Recall。
 * 有 saved/bookmarked/note 等锚时放行，避免误伤「weather article I saved」。
 */
export function looksLikeNonRecallLifeRequest(clue: string): boolean {
  if (clueHasAnySurface(clue, MEMORY_RECALL_ANCHOR_SURFACES)) {
    return false
  }
  return clueHasAnySurface(clue, NON_RECALL_LIFE_SURFACES)
}

/**
 * 助手发令里可残留、但仍视为「无强记忆锚」的词（如 bored）。
 * 与弱偏好表分工：bored 须能进 Filter 找回「being bored」类标题；发令句另拦。
 */
const ASSISTANT_MOOD_ONLY_CONTENT_TERMS = new Set(['bored'])

/**
 * 零锚点 / 非找回：生活助手意图，或助手发令且无强内容锚，或无有效内容词且无约束 → 不扫库。
 */
export function shouldSkipRecallAsZeroAnchor(clue: string, parsed: ParsedRecallClue): boolean {
  if (looksLikeNonRecallLifeRequest(clue)) {
    return true
  }
  const effectiveTerms = effectiveContentTermsForRecall(parsed)
  // 助手发令（i feel bored / recommend…）优先：仅 mood 残留词（bored）不得放行扫库
  if (looksLikeAssistantImperativeClue(clue)) {
    const strongTerms = effectiveTerms.filter(
      term => !ASSISTANT_MOOD_ONLY_CONTENT_TERMS.has(normalizeRecallText(term))
    )
    if (strongTerms.length === 0) {
      return true
    }
  }
  if (effectiveTerms.length > 0) {
    return false
  }
  return !shouldRecallByConstraintNeighborhood(parsed)
}

/**
 * 由解析结果拼 Filter 检索词面（`filterClue`）。不做内容别名扩词。
 *
 * Gap 4（D3-C）变更：filterClue 仅含 contentTerms，不含 Topic terms。
 * - Topic 走独立检索路径（`topicLookup` → 语义邻域）
 * - contentTerms 走关键词检索（本函数）
 * - 两者结果在 recallByKeywordWithParsedClue 中取并集 · 去重
 */
export function buildFilterClueFromParsed(parsed: ParsedRecallClue): string {
  const contentTerms = effectiveContentTermsForRecall(parsed)
  if (contentTerms.length > 0) {
    return contentTerms.join(' ')
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
  return resolveMemoryItemSavedAtMs(item)
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
 * 解析后的时间约束是否应硬筛（ADR-011）。
 * - 显式 timeConfidence 优先
 * - 无字段时按 label 派生
 * - recently_saved 合成 recent 窗（无显式 timeLabel）按 high
 */
export function resolveEffectiveTimeConfidence(
  parsed: ParsedRecallClue,
  range: RecallTimeRange | undefined
): RecallTimeConfidence | undefined {
  if (!range) {
    return undefined
  }
  if (parsed.timeConfidence) {
    return parsed.timeConfidence
  }
  if (parsed.timeRange) {
    return timeConfidenceForRelativeLabel(parsed.timeRange.label)
  }
  // effectiveParsedTimeRange 合成的 recent（刚存）→ 硬筛近窗
  if (parsed.behaviorHints?.includes('recently_saved') && range.label === 'recent') {
    return 'high'
  }
  return timeConfidenceForRelativeLabel(range.label)
}

/** 是否应对命中列表做时间硬排除。 */
export function shouldHardFilterByTime(
  parsed: ParsedRecallClue,
  range: RecallTimeRange | undefined = parsed.timeRange
): boolean {
  return resolveEffectiveTimeConfidence(parsed, range) === 'high'
}

/**
 * high 置信时硬排除窗外命中（含刚存合成的 recent 窗）。
 * low 置信不硬切（软加分见 applyParsedClueScoreBoosts）。
 */
export function filterMatchesByParsedTimeRange(
  matches: RecallMatch[],
  parsed: ParsedRecallClue,
  nowMs: number = Date.now()
): RecallMatch[] {
  const range = effectiveParsedTimeRange(parsed, nowMs)
  if (!range) {
    return matches
  }
  if (!shouldHardFilterByTime(parsed, range)) {
    return matches
  }
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

  // 保留空格：compact 会把 notes+on+g 粘成 notesong，伪命中 song
  return normalizeRecallText(parts.join(' '))
}

function isAsciiWordChar(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9]/.test(char))
}

/** 条目文本是否含类型词面（ASCII 须词边界，避免 notesong⊂song）。 */
function itemBlobHasSurface(normalizedBlob: string, surface: string): boolean {
  const needle = normalizeRecallText(surface)
  if (!needle) {
    return false
  }
  const isAsciiNeedle = /^[a-z0-9 ]+$/.test(needle)
  if (!isAsciiNeedle) {
    return normalizedBlob.includes(needle)
  }

  let fromIndex = 0
  while (fromIndex < normalizedBlob.length) {
    const index = normalizedBlob.indexOf(needle, fromIndex)
    if (index < 0) {
      return false
    }
    const before = normalizedBlob[index - 1]
    const after = normalizedBlob[index + needle.length]
    if (!isAsciiWordChar(before) && !isAsciiWordChar(after)) {
      return true
    }
    fromIndex = index + 1
  }
  return false
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
  return surfaces.some(surface => surface.length > 0 && itemBlobHasSurface(blob, surface))
}

/**
 * 无内容词 + 时间/刚存/类型约束：按近因列邻域，禁止把虚词当关键词扫库。
 * 产品：用户忘了标题才开口；「just saved」「recently collected bookmark」均须出邻域。
 *
 * **模型语义（§7.05 · ADR-014 · D1-B 退化弱 Topic，2026-10-06 裁决）：**
 * 本函数是 Recall Request 模型中 **Preference-driven 路径** 的入口判定器——
 * 当请求无内容词、但存在强类型 / 时间（high 置信）/ 刚存约束时，认为请求携带一个退化弱 Topic，
 * 仍属 Recall 范畴（区别于 `missing_topic` → Discovery 边界）。
 * 不可与「零锚点助手发令」混淆；后者走 `shouldSkipRecallAsZeroAnchor`。
 */
export function shouldRecallByConstraintNeighborhood(parsed: ParsedRecallClue): boolean {
  // 用检索有效内容词：play/like 等弱残留不得挡约束邻域（R0 助手发令）
  if (effectiveContentTermsForRecall(parsed).length > 0) {
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
 * 获取约束邻域过滤后的 item 池（时间/类型硬筛）。
 *
 * 用途：Gap 4 TopicLookup 须在约束过滤后的池中运行，而非全量 items，
 * 避免 TopicLookup 绕过时间/类型过滤。
 *
 * @param items 全量候选池
 * @param parsed 解析结果
 * @param nowMs 当前时间戳
 * @returns 约束过滤后的 MemoryItem[]（时间/类型硬筛后）
 */
function getConstraintFilteredPool(
  items: MemoryItem[],
  parsed: ParsedRecallClue,
  nowMs: number
): MemoryItem[] {
  const range = effectiveParsedTimeRange(parsed, nowMs)
  const types = parsed.objectTypes
  const timeConfidence = resolveEffectiveTimeConfidence(parsed, range)

  let pool = items
  if (types && types.length > 0) {
    pool = pool.filter(item => types.some(type => memoryItemMatchesObjectType(item, type)))
  }
  if (range && timeConfidence === 'high') {
    pool = pool.filter(item => memoryItemInTimeRange(item, range))
  }
  return pool
}

/**
 * 约束邻域：时间按置信硬筛或软排 + 可选类型过滤，按 createdAt 近因打分。
 * 最新一条须达 Top Pick 阈值（建议，非神谕）。
 */
export function recallMatchesByConstraintNeighborhood(
  items: MemoryItem[],
  parsed: ParsedRecallClue,
  nowMs: number
): RecallMatch[] {
  const range = effectiveParsedTimeRange(parsed, nowMs)
  const types = parsed.objectTypes
  const timeConfidence = resolveEffectiveTimeConfidence(parsed, range)

  let pool = items
  if (types && types.length > 0) {
    pool = pool.filter(item => types.some(type => memoryItemMatchesObjectType(item, type)))
  }
  if (range && timeConfidence === 'high') {
    pool = pool.filter(item => memoryItemInTimeRange(item, range))
  }

  if (pool.length === 0) {
    return []
  }

  const ranked = [...pool].sort((left, right) => {
    if (range && timeConfidence === 'low') {
      const leftIn = memoryItemInTimeRange(left, range) ? 1 : 0
      const rightIn = memoryItemInTimeRange(right, range) ? 1 : 0
      if (rightIn !== leftIn) {
        return rightIn - leftIn
      }
    }
    return itemCreatedMs(right) - itemCreatedMs(left)
  })
  const newestMs = itemCreatedMs(ranked[0]!)

  return ranked.map((item, index) => {
    const ageGapDays = Math.max(0, (newestMs - itemCreatedMs(item)) / (24 * 60 * 60 * 1000))
    // 最新 = Top Pick 门槛；越旧分越低，仍可进 Also Possible
    let score = Math.max(1, RECALL_TOP_PICK_MIN_SCORE - index - Math.floor(ageGapDays))
    if (range && timeConfidence === 'low' && !memoryItemInTimeRange(item, range)) {
      score = Math.max(1, score - CONSTRAINT_OUT_OF_RANGE_SCORE_PENALTY)
    }
    return {
      item,
      score,
      matchedFields: ['constraint_neighborhood']
    }
  })
}

/** 在已有词面分上叠加结构化软加权（无词面命中不加）。high 时间已硬过滤；low 时间窗内另加 soft boost。 */
export function applyParsedClueScoreBoosts(
  match: RecallMatch,
  parsed: ParsedRecallClue,
  nowMs: number = Date.now()
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

  const softTimeRange = parsed.timeRange
  if (
    softTimeRange &&
    resolveEffectiveTimeConfidence(parsed, softTimeRange) === 'low' &&
    memoryItemInTimeRange(match.item, softTimeRange)
  ) {
    boost += RECALL_ORCHESTRATION_TIME_SOFT_IN_RANGE_BOOST
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
 * 时间硬/软筛 → 内容佐证；high 空佐证时一次 soft 回退。
 */
export function applyTimeFilterThenContentCorroborationWithSoftReopen(
  scoredMatches: RecallMatch[],
  parsed: ParsedRecallClue,
  nowMs: number = Date.now()
): {
  matches: RecallMatch[]
  effectiveParsed: ParsedRecallClue
  timeSoftReopen: boolean
} {
  const hardTimed = filterMatchesByParsedTimeRange(scoredMatches, parsed, nowMs)
  const corroborationTerms = effectiveContentTermsForRecall(parsed)
  let corroborated = filterMatchesByContentTermCorroboration(hardTimed, corroborationTerms)
  if (!shouldAttemptTimeSoftReopen(parsed, corroborated.length)) {
    return { matches: corroborated, effectiveParsed: parsed, timeSoftReopen: false }
  }
  const softParsed = parsedClueForTimeSoftReopen(parsed)
  const softTimed = filterMatchesByParsedTimeRange(scoredMatches, softParsed, nowMs)
  corroborated = filterMatchesByContentTermCorroboration(softTimed, corroborationTerms)
  return {
    matches: corroborated,
    effectiveParsed: softParsed,
    timeSoftReopen: true
  }
}

/**
 * 带口语解析的关键词 Recall。
 * RecallResult.clue 仍为用户原始 clue（UI 展示）；内部 Filter 可用剥离槽位后的 `filterClue`。
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
  const parsed = withRecallTopic(options.parsed ?? parseRecallClue(raw, { nowMs }))
  const poolLimit = options.candidateLimit ?? RECALL_RESULT_POOL_LIMIT

  if (shouldSkipRecallAsZeroAnchor(raw, parsed)) {
    return injectTopic(
      {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: raw,
        parsed,
        // H-topic：零锚点即无主题锚，标缺主题。
        ...(hasRecallTopicAnchor(parsed) ? {} : { emptyKind: 'missing_topic' as const })
      },
      parsed
    )
  }

  // H-topic 主题必填：无主题锚（无 C/G）且非时间/类型约束邻域 → 不进检索。
  // 泛词撑不起一次检索（如 "A word that was learned before"）：返回什么都是错的。
  if (!hasRecallTopicAnchor(parsed) && !shouldRecallByConstraintNeighborhood(parsed)) {
    return injectTopic(
      {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: raw,
        parsed,
        emptyKind: 'missing_topic',
        relatedGuess: null
      },
      parsed
    )
  }

  if (shouldRecallByConstraintNeighborhood(parsed)) {
    // 约束邻域分支：时间/类型过滤后，补充 TopicLookup（独立语义路径）。
    // 注意：约束邻域本身无 contentTerms，Topic terms 来自 parsed.topic（独立来源）。

    // 获取约束过滤后的 item 池（时间/类型硬筛后的条目，供 TopicLookup 用）。
    // 注意：这里直接复用 recallMatchesByConstraintNeighborhood 内部的过滤逻辑。
    // 为避免重复计算，先用约束邻域获取过滤后的 pool。
    const constraintPool = getConstraintFilteredPool(items, parsed, nowMs)

    const constraintMatches = recallMatchesByConstraintNeighborhood(items, parsed, nowMs).map(
      match => applyParsedClueScoreBoosts(match, parsed, nowMs)
    )

    // TopicLookup：约束邻域池中补充 topic 相关条目（并集 · 不删现有）。
    // 注意：用过滤后的 constraintPool 而非全量 items，避免 TopicLookup 绕过时间过滤。
    // D3-C：Gap 5 Topic 语义化——topicEmbedding 从 parsed.topic 透传；有则走 embedding 路径，无则走词法路径。
    if (parsed.topic && constraintPool.length < items.length) {
      // 仅在约束邻域有实质过滤时调用 TopicLookup（全量池无需补充）。
      const topicDescriptor: TopicDescriptor = {
        displayName: parsed.topic.terms.length > 0 ? parsed.topic.terms.join(' ') : '(weak topic)',
        tokens: parsed.topic.terms,
        ...(parsed.topic.embedding ? { embedding: parsed.topic.embedding } : {})
      }
      const topicResult = topicLookup(constraintPool, topicDescriptor, parsed.topic.embedding)
      if (!topicResult.topicSkipped && topicResult.topicMatches.length > 0) {
        const merged = mergeTopicLookupWithKeywordMatches(constraintMatches, topicResult)
        const sorted = merged.sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score
          return right.item.updatedAt.localeCompare(left.item.updatedAt)
        })
        const collapsed = collapseRecallMatches(sorted, {
          limit: poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
        })
        return injectTopic(buildRecallResult(raw, collapsed), parsed)
      }
    }
    constraintMatches.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return right.item.updatedAt.localeCompare(left.item.updatedAt)
    })
    const collapsed = collapseRecallMatches(constraintMatches, {
      limit: poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
    })
    return injectTopic(buildRecallResult(raw, collapsed), parsed)
  }

  const filterClue = buildFilterClueFromParsed(parsed)

  const scored = filterKeywordMatchesBeforeCollapse(items, filterClue, {
    nowMs,
    ...(options.fuzzyExpandTokens ? { fuzzyExpandTokens: options.fuzzyExpandTokens } : {}),
    ...(options.behaviorProfile ? { behaviorProfile: options.behaviorProfile } : {})
  }).map(match => applyParsedClueScoreBoosts(match, parsed, nowMs))
  const { matches, effectiveParsed, timeSoftReopen } =
    applyTimeFilterThenContentCorroborationWithSoftReopen(scored, parsed, nowMs)

  // soft 回退时用 softParsed 再叠一次时间软加分（窗内 +12）
  const rescored = timeSoftReopen
    ? matches.map(match => applyParsedClueScoreBoosts(match, effectiveParsed, nowMs))
    : matches

  rescored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })

  const collapsed = collapseRecallMatches(rescored, {
    limit: poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  const result = buildRecallResult(raw, collapsed, {
    contentTerms: effectiveContentTermsForRecall(parsed)
  })
  const withTopic = injectTopic(result, parsed)
  if (!timeSoftReopen) {
    return withTopic
  }
  return {
    ...withTopic,
    parsed: effectiveParsed
  }
}
