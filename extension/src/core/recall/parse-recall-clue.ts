/**
 * 规则解析：用户线索 → 结构化约束（纯规则，无 LLM / embedding）。
 *
 * **定位（ADR-021）：** 闭集槽位接地 + Omnibox 本机快跳 + 无模型/失败/断网时的降级垫片。
 * **不是**口语听懂主引擎，也不是离线主 NLU；主路径听懂见 `understandRecallClue` + LLM。
 */

import { applyRuleExcludeToContentTerms } from '@/core/recall/exclude-content-terms'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  RECALL_BEHAVIOR_LEXICON,
  RECALL_CLUE_FILLER_SURFACES,
  RECALL_NOTE_HINT_LEXICON,
  RECALL_OBJECT_TYPE_LEXICON,
  RECALL_TIME_LEXICON,
  type RecallLexiconEntry,
  type RecallRelativeTimeLabel
} from '@/core/recall/parse-recall-clue-lexicon'
import {
  ParsedRecallClueSchema,
  type ParsedRecallClue,
  type RecallBehaviorHint,
  type RecallClueConfidence,
  type RecallObjectType,
  type RecallTimeConfidence,
  type RecallTimeRange
} from '@/core/recall/parse-recall-clue-types'

const DAY_MS = 24 * 60 * 60 * 1000

/** 解析可选时钟（单测固定 now，避免日期漂移）。 */
export interface ParseRecallClueOptions {
  nowMs?: number
}

type MatchedSpan = {
  start: number
  end: number
}

function startOfUtcDay(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

/** 将相对时间标签换成 UTC 日界闭区间。 */
export function resolveRelativeTimeRange(
  label: RecallRelativeTimeLabel,
  nowMs: number
): RecallTimeRange {
  const todayStart = startOfUtcDay(nowMs)

  switch (label) {
    case 'today':
      return {
        from: toIso(todayStart),
        to: toIso(todayStart + DAY_MS - 1),
        label
      }
    case 'yesterday':
      return {
        from: toIso(todayStart - DAY_MS),
        to: toIso(todayStart - 1),
        label
      }
    case 'day_before_yesterday':
      return {
        from: toIso(todayStart - 2 * DAY_MS),
        to: toIso(todayStart - DAY_MS - 1),
        label
      }
    case 'last_week':
      return {
        from: toIso(todayStart - 7 * DAY_MS),
        to: toIso(todayStart - 1),
        label
      }
    case 'recent':
      return {
        from: toIso(todayStart - 7 * DAY_MS),
        to: toIso(nowMs),
        label
      }
    case 'a_while_ago':
      // 约数周：排除近 3 天，上界约 30 天
      return {
        from: toIso(todayStart - 30 * DAY_MS),
        to: toIso(todayStart - 3 * DAY_MS - 1),
        label
      }
    case 'last_month':
      // 大约一个月前：偏宽窗，避免硬过滤误杀（约 2–6 周）
      return {
        from: toIso(todayStart - 60 * DAY_MS),
        to: toIso(todayStart - 14 * DAY_MS - 1),
        label
      }
    case 'few_months_ago':
      // 几个月前：偏宽窗（约 1.5–6 个月），服务 a few months back 等口语
      return {
        from: toIso(todayStart - 180 * DAY_MS),
        to: toIso(todayStart - 45 * DAY_MS - 1),
        label
      }
    case 'long_ago':
      return {
        from: toIso(todayStart - 365 * DAY_MS),
        to: toIso(todayStart - 30 * DAY_MS - 1),
        label
      }
  }
}

/**
 * 相对时间 label → 硬筛/软排置信（ADR-011 · 确定性闭集）。
 * 日历级 = high；糊远距/模糊近因 = low。
 */
export function timeConfidenceForRelativeLabel(
  label: RecallRelativeTimeLabel | string
): RecallTimeConfidence {
  switch (label) {
    case 'today':
    case 'yesterday':
    case 'day_before_yesterday':
    case 'last_week':
    case 'last_month':
      return 'high'
    case 'recent':
    case 'a_while_ago':
    case 'few_months_ago':
    case 'long_ago':
      return 'low'
    default:
      // 未知 label 保守走软排，避免误硬空
      return 'low'
  }
}

function sortLexiconBySurfaceLengthDesc<T extends string>(
  entries: RecallLexiconEntry<T>[]
): RecallLexiconEntry<T>[] {
  return [...entries].sort((left, right) => right.surface.length - left.surface.length)
}

function isAsciiWordChar(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9]/.test(char))
}

/** ASCII 词典命中须近似词边界，避免 bookmark 吞掉 bookmarked。 */
function canMatchLexiconAt(text: string, index: number, needle: string): boolean {
  const isAsciiNeedle = /^[a-z0-9 ]+$/.test(needle)
  if (!isAsciiNeedle) {
    return true
  }

  const before = index > 0 ? text[index - 1] : undefined
  const after = index + needle.length < text.length ? text[index + needle.length] : undefined
  return !isAsciiWordChar(before) && !isAsciiWordChar(after)
}

/**
 * 在 haystack 中找所有不重叠的词典命中（更长 surface 优先）。
 * haystack 应为已 normalize 的小写文本；occupied 可跨词典共享。
 */
function collectLexiconHits<T extends string>(
  haystack: string,
  lexicon: RecallLexiconEntry<T>[],
  occupied: boolean[]
): { values: T[]; spans: MatchedSpan[] } {
  const values: T[] = []
  const spans: MatchedSpan[] = []
  const ordered = sortLexiconBySurfaceLengthDesc(lexicon)

  for (const entry of ordered) {
    const needle = normalizeRecallText(entry.surface)
    if (!needle) {
      continue
    }

    let fromIndex = 0
    while (fromIndex < haystack.length) {
      const index = haystack.indexOf(needle, fromIndex)
      if (index < 0) {
        break
      }
      const end = index + needle.length
      const overlaps = occupied.slice(index, end).some(Boolean)
      if (!overlaps && canMatchLexiconAt(haystack, index, needle)) {
        for (let i = index; i < end; i += 1) {
          occupied[i] = true
        }
        if (!values.includes(entry.value)) {
          values.push(entry.value)
        }
        spans.push({ start: index, end })
      }
      fromIndex = index + 1
    }
  }

  return { values, spans }
}

/** 用空格盖住已消费区间，便于抽 contentTerms。 */
function maskSpans(text: string, spans: MatchedSpan[]): string {
  if (spans.length === 0) {
    return text
  }
  const chars = [...text]
  for (const span of spans) {
    for (let i = span.start; i < span.end && i < chars.length; i += 1) {
      chars[i] = ' '
    }
  }
  return chars.join('')
}

function maskFillerSurfaces(text: string): string {
  let masked = text
  const fillers = RECALL_CLUE_FILLER_SURFACES.sort((a, b) => b.length - a.length)
  for (const filler of fillers) {
    const needle = normalizeRecallText(filler)
    if (!needle) {
      continue
    }
    // 全局替换为等长空格，ASCII filler 需满足近似词边界，避免吞掉 about / cloudflare 等词内片段。
    let next = ''
    let cursor = 0
    while (cursor < masked.length) {
      const index = masked.indexOf(needle, cursor)
      if (index < 0) {
        next += masked.slice(cursor)
        break
      }
      if (!canMatchLexiconAt(masked, index, needle)) {
        next += masked.slice(cursor, index + 1)
        cursor = index + 1
        continue
      }
      next += masked.slice(cursor, index)
      next += ' '.repeat(needle.length)
      cursor = index + needle.length
    }
    masked = next
  }
  return masked
}

/**
 * 从残留文本抽出内容词：拉丁词 + 连续汉字块（长度 ≥ 1）。
 * 不做 ngram，避免把「李白」拆成噪声。
 */
export function extractContentTerms(residue: string): string[] {
  const normalized = normalizeRecallText(residue)
  if (!normalized.trim()) {
    return []
  }

  const terms: string[] = []
  const seen = new Set<string>()
  const pattern = /[a-z0-9][a-z0-9._/-]*|[\u3400-\u9fff]+/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(normalized)) !== null) {
    const token = match[0]
    if (!token || seen.has(token)) {
      continue
    }
    seen.add(token)
    terms.push(token)
  }
  return terms
}

function countSignalCategories(input: {
  hasTime: boolean
  hasObject: boolean
  hasBehavior: boolean
  hasNote: boolean
  hasContent: boolean
}): number {
  return [
    input.hasTime,
    input.hasObject,
    input.hasBehavior,
    input.hasNote,
    input.hasContent
  ].filter(Boolean).length
}

/** 按信号类别数计算置信度（规则与 LLM 后处理共用）。 */
export function resolveRecallClueConfidence(input: {
  hasTime: boolean
  hasObject: boolean
  hasBehavior: boolean
  hasNote: boolean
  hasContent: boolean
}): RecallClueConfidence {
  const { hasTime, hasObject, hasNote, hasContent } = input
  if (
    (hasTime && hasObject && hasContent) ||
    (hasNote && hasContent) ||
    (hasTime && hasContent && hasNote)
  ) {
    return 'high'
  }
  if (countSignalCategories(input) >= 2) {
    return 'medium'
  }
  return 'low'
}

/** 解析口语线索为结构化约束。 */
export function parseRecallClue(
  clue: string,
  options: ParseRecallClueOptions = {}
): ParsedRecallClue {
  const raw = clue.trim()
  if (!raw) {
    return ParsedRecallClueSchema.parse({
      raw: '',
      contentTerms: [],
      confidence: 'low'
    })
  }

  const nowMs = options.nowMs ?? Date.now()
  const normalized = normalizeRecallText(raw)

  // 各类词典共用占用表，按 surface 长度优先，避免交叉重叠误吞
  const occupied = new Array<boolean>(normalized.length).fill(false)
  const timeHits = collectLexiconHits(normalized, RECALL_TIME_LEXICON, occupied)
  const objectHits = collectLexiconHits(normalized, RECALL_OBJECT_TYPE_LEXICON, occupied)
  const behaviorHits = collectLexiconHits(normalized, RECALL_BEHAVIOR_LEXICON, occupied)
  const noteHits = collectLexiconHits(normalized, RECALL_NOTE_HINT_LEXICON, occupied)

  const allSpans = [
    ...timeHits.spans,
    ...objectHits.spans,
    ...behaviorHits.spans,
    ...noteHits.spans
  ]

  const residue = maskFillerSurfaces(maskSpans(normalized, allSpans))
  const rawContentTerms = extractContentTerms(residue)

  const timeLabel = timeHits.values[0]
  const timeRange = timeLabel ? resolveRelativeTimeRange(timeLabel, nowMs) : undefined
  const timeConfidence = timeLabel ? timeConfidenceForRelativeLabel(timeLabel) : undefined
  let objectTypes = objectHits.values as RecallObjectType[]
  let behaviorHints = behaviorHits.values as RecallBehaviorHint[]
  const noteHint = noteHits.values.length > 0 ? true : undefined

  // 「just bookmarked」整句先被行为词典占满时，仍补上 bookmark 类型意图
  objectTypes = reinforceBookmarkObjectType(normalized, objectTypes)
  // 「recently collected」若时间词先占 recently，仍补 recently_saved
  behaviorHints = reinforceRecentlySavedBehavior(normalized, behaviorHints)

  // 明确排除跨度 → excludeContentTerms；否则仅剥孤立否定标记，不猜排除范围
  const { contentTerms, excludeContentTerms } = applyRuleExcludeToContentTerms(
    normalized,
    rawContentTerms
  )

  const hasTime = Boolean(timeRange)
  const hasObject = objectTypes.length > 0
  const hasBehavior = behaviorHints.length > 0
  const hasNote = noteHint === true
  const hasContent = contentTerms.length > 0

  const parsed: ParsedRecallClue = {
    raw,
    contentTerms,
    confidence: resolveRecallClueConfidence({
      hasTime,
      hasObject,
      hasBehavior,
      hasNote,
      hasContent
    }),
    ...(timeRange ? { timeRange } : {}),
    ...(timeConfidence ? { timeConfidence } : {}),
    ...(hasObject ? { objectTypes } : {}),
    ...(hasBehavior ? { behaviorHints } : {}),
    ...(noteHint ? { noteHint } : {}),
    ...(excludeContentTerms.length > 0 ? { excludeContentTerms } : {})
  }

  return ParsedRecallClueSchema.parse(parsed)
}

/** 线索明示 bookmark(s)/bookmarked 时补上 objectType（行为长句可能先占满 span）。 */
export function reinforceBookmarkObjectType(
  normalizedClue: string,
  objectTypes: RecallObjectType[]
): RecallObjectType[] {
  if (objectTypes.includes('bookmark')) {
    return objectTypes
  }
  if (/\bbookmarks?\b/.test(normalizedClue) || /\bbookmarked\b/.test(normalizedClue)) {
    return [...objectTypes, 'bookmark']
  }
  return objectTypes
}

/** 时间词先占 recently 时，仍识别 collected/just saved 等为 recently_saved。 */
export function reinforceRecentlySavedBehavior(
  normalizedClue: string,
  behaviorHints: RecallBehaviorHint[]
): RecallBehaviorHint[] {
  if (behaviorHints.includes('recently_saved')) {
    return behaviorHints
  }
  if (
    /\b(recently collected|just collected|newly collected|just saved|just stored|just bookmarked|newly saved)\b/.test(
      normalizedClue
    ) ||
    (/\bcollected\b/.test(normalizedClue) && /\bbookmarks?\b/.test(normalizedClue))
  ) {
    return [...behaviorHints, 'recently_saved']
  }
  return behaviorHints
}
