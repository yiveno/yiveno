/**
 * 将用户口语线索解析为结构化约束（P0 · 纯规则，无 LLM / embedding）。
 * 当前仅提供解析能力，不接入 KeywordRecallBackend。
 */

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
  RECALL_CLUE_LOCALE_FILLER_SURFACES,
  RECALL_OBJECT_TYPE_LOCALE_ALIASES
} from '@/core/recall/parse-recall-clue-locale-aliases'
import {
  ParsedRecallClueSchema,
  type ParsedRecallClue,
  type RecallBehaviorHint,
  type RecallClueConfidence,
  type RecallObjectType,
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
      return {
        from: toIso(todayStart - 30 * DAY_MS),
        to: toIso(todayStart - 3 * DAY_MS - 1),
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

function sortLexiconBySurfaceLengthDesc<T extends string>(
  entries: RecallLexiconEntry<T>[]
): RecallLexiconEntry<T>[] {
  return [...entries].sort((left, right) => right.surface.length - left.surface.length)
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
      if (!overlaps) {
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

function isAsciiWordChar(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9]/.test(char))
}

function canMaskAt(text: string, index: number, needle: string): boolean {
  const isAsciiNeedle = /^[a-z0-9 ]+$/.test(needle)
  if (!isAsciiNeedle) {
    return true
  }

  const before = index > 0 ? text[index - 1] : undefined
  const after = index + needle.length < text.length ? text[index + needle.length] : undefined
  return !isAsciiWordChar(before) && !isAsciiWordChar(after)
}

function maskFillerSurfaces(text: string): string {
  let masked = text
  const fillers = [...RECALL_CLUE_FILLER_SURFACES, ...RECALL_CLUE_LOCALE_FILLER_SURFACES].sort(
    (a, b) => b.length - a.length
  )
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
      if (!canMaskAt(masked, index, needle)) {
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
  const objectHits = collectLexiconHits(
    normalized,
    [...RECALL_OBJECT_TYPE_LEXICON, ...RECALL_OBJECT_TYPE_LOCALE_ALIASES],
    occupied
  )
  const behaviorHits = collectLexiconHits(normalized, RECALL_BEHAVIOR_LEXICON, occupied)
  const noteHits = collectLexiconHits(normalized, RECALL_NOTE_HINT_LEXICON, occupied)

  const allSpans = [
    ...timeHits.spans,
    ...objectHits.spans,
    ...behaviorHits.spans,
    ...noteHits.spans
  ]

  const residue = maskFillerSurfaces(maskSpans(normalized, allSpans))
  const contentTerms = extractContentTerms(residue)

  const timeLabel = timeHits.values[0]
  const timeRange = timeLabel ? resolveRelativeTimeRange(timeLabel, nowMs) : undefined
  const objectTypes = objectHits.values as RecallObjectType[]
  const behaviorHints = behaviorHits.values as RecallBehaviorHint[]
  const noteHint = noteHits.values.length > 0 ? true : undefined

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
    ...(hasObject ? { objectTypes } : {}),
    ...(hasBehavior ? { behaviorHints } : {}),
    ...(noteHint ? { noteHint } : {})
  }

  return ParsedRecallClueSchema.parse(parsed)
}
