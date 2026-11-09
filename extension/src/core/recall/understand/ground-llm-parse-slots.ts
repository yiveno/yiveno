import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  RECALL_BEHAVIOR_LEXICON,
  RECALL_OBJECT_TYPE_LEXICON,
  RECALL_TIME_LEXICON,
  type RecallRelativeTimeLabel
} from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallBehaviorHint, RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/**
 * 槽位门禁只认 `parse-recall-clue-lexicon` 闭集 surface（产品语言 → 枚举）。
 * **禁止**再维护第二套 LLM 影子别名表（2026-10-30 已并入主词典）。
 */

function isAsciiWordChar(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9]/.test(char))
}

/** ASCII surface 须词边界，避免 bookmark⊂bookmarked。 */
function clueHasSurface(normalizedClue: string, surface: string): boolean {
  const needle = normalizeRecallText(surface)
  if (!needle) {
    return false
  }
  const isAsciiNeedle = /^[a-z0-9 ]+$/.test(needle)
  if (!isAsciiNeedle) {
    return normalizedClue.includes(needle)
  }

  let fromIndex = 0
  while (fromIndex < normalizedClue.length) {
    const index = normalizedClue.indexOf(needle, fromIndex)
    if (index < 0) {
      return false
    }
    const before = index > 0 ? normalizedClue[index - 1] : undefined
    const after =
      index + needle.length < normalizedClue.length
        ? normalizedClue[index + needle.length]
        : undefined
    if (!isAsciiWordChar(before) && !isAsciiWordChar(after)) {
      return true
    }
    fromIndex = index + 1
  }
  return false
}

/** 保留有词面支撑的行为；线索命中词典时即使模型漏提也补上。 */
export function groundBehaviorHints(
  clue: string,
  hints: RecallBehaviorHint[] | undefined
): RecallBehaviorHint[] | undefined {
  const normalized = normalizeRecallText(clue)
  const kept = new Set<RecallBehaviorHint>()

  for (const hint of hints ?? []) {
    const lexiconHit = RECALL_BEHAVIOR_LEXICON.some(
      entry => entry.value === hint && clueHasSurface(normalized, entry.surface)
    )
    if (lexiconHit) {
      kept.add(hint)
    }
  }

  // 规则词典词面命中也补上（模型漏提 recently_saved / half_read 时）
  for (const entry of RECALL_BEHAVIOR_LEXICON) {
    if (clueHasSurface(normalized, entry.surface)) {
      kept.add(entry.value)
    }
  }

  return kept.size > 0 ? [...kept] : undefined
}

/** 电影/书名等固定短语里的 note（如 million pound note）不是检索词，避免误命中 NotebookLM。 */
export function dropMisleadingNoteContentTerm(normalizedClue: string, terms: string[]): string[] {
  if (!terms.includes('note')) {
    return terms
  }
  const titlePhrases = ['million pound note', 'pound note', 'bank note']
  if (titlePhrases.some(phrase => normalizedClue.includes(phrase))) {
    return terms.filter(term => term !== 'note')
  }
  return terms
}

/** 线索中的四位公历年份 token（1900–2099），作内容词而非「我何时保存」。 */
function extractCalendarYearTokens(normalizedClue: string): string[] {
  return normalizedClue.split(/[^\p{L}\p{N}]+/u).filter(token => /^(19|20)\d{2}$/.test(token))
}

/**
 * 软年龄形容词（old / ancient）：口语修饰内容，不是相对时间窗词面。
 * 无 yesterday/recent/long ago 等词典命中时，不得采纳模型 timeLabel（否则会硬过滤掉「很久以前存的论文」）。
 */
const SOFT_AGE_ADJECTIVE_SURFACES = ['ancient', 'older', 'old'] as const

function clueHasSoftAgeAdjectiveOnly(normalizedClue: string): boolean {
  return SOFT_AGE_ADJECTIVE_SURFACES.some(surface => clueHasSurface(normalizedClue, surface))
}

/**
 * 模型常把电影/书名年份（如 1954）误映射为 long_ago；无相对时间词面时不得采纳。
 * 同样拒纳仅靠 soft「old」臆造的 a_while_ago / long_ago。
 */
function shouldRejectProposedTimeLabelWithoutLexicon(
  normalizedClue: string,
  proposed: RecallRelativeTimeLabel | null | undefined
): boolean {
  if (!proposed) {
    return false
  }
  if (extractCalendarYearTokens(normalizedClue).length > 0) {
    return true
  }
  return clueHasSoftAgeAdjectiveOnly(normalizedClue)
}

/**
 * 时间标签：若线索命中词典词面，优先用最长 surface 对应 label（纠偏 LLM 的 recent/a_while_ago 混淆）。
 * 无线索词面时才回退模型提议；但若仅有公历年份或 soft「old」、无相对时间词面，丢弃模型 timeLabel。
 */
export function groundTimeLabel(
  clue: string,
  proposed: RecallRelativeTimeLabel | null | undefined
): RecallRelativeTimeLabel | undefined {
  const normalized = normalizeRecallText(clue)
  const hits = RECALL_TIME_LEXICON.filter(entry => clueHasSurface(normalized, entry.surface)).sort(
    (a, b) => b.surface.length - a.surface.length
  )
  if (hits[0]) {
    return hits[0].value
  }
  if (shouldRejectProposedTimeLabelWithoutLexicon(normalized, proposed)) {
    return undefined
  }
  return proposed ?? undefined
}

/**
 * 只保留线索中确有词典词面支撑的对象类型；词面命中时可补全模型漏提的类型。
 */
export function groundObjectTypes(
  clue: string,
  types: RecallObjectType[] | undefined
): RecallObjectType[] | undefined {
  const normalized = normalizeRecallText(clue)
  const kept = new Set<RecallObjectType>()

  for (const type of types ?? []) {
    const lexiconHit = RECALL_OBJECT_TYPE_LEXICON.some(
      entry => entry.value === type && clueHasSurface(normalized, entry.surface)
    )
    if (lexiconHit) {
      kept.add(type)
    }
  }

  // 规则词典词面命中也补上（模型漏提 bookmark / article 时）
  for (const entry of RECALL_OBJECT_TYPE_LEXICON) {
    if (clueHasSurface(normalized, entry.surface)) {
      kept.add(entry.value)
    }
  }

  return kept.size > 0 ? [...kept] : undefined
}

/** 从 contentTerms 去掉已用于时间/类型/行为的词面 token，减少 verse/from 等泄漏。 */
export function stripGroundedSurfacesFromTerms(
  clue: string,
  terms: string[],
  input: {
    timeLabel?: RecallRelativeTimeLabel
    objectTypes?: RecallObjectType[]
    behaviorHints?: RecallBehaviorHint[]
  }
): string[] {
  const normalizedClue = normalizeRecallText(clue)
  const blocklist = new Set<string>()

  const addSurfaceTokens = (surface: string) => {
    const tokens = normalizeRecallText(surface)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
    for (const token of tokens) {
      blocklist.add(token)
    }
  }

  if (input.timeLabel) {
    for (const entry of RECALL_TIME_LEXICON) {
      if (entry.value === input.timeLabel && clueHasSurface(normalizedClue, entry.surface)) {
        addSurfaceTokens(entry.surface)
      }
    }
  }

  if (input.objectTypes) {
    for (const type of input.objectTypes) {
      for (const entry of RECALL_OBJECT_TYPE_LEXICON) {
        if (entry.value === type && clueHasSurface(normalizedClue, entry.surface)) {
          addSurfaceTokens(entry.surface)
        }
      }
    }
  }

  if (input.behaviorHints) {
    for (const hint of input.behaviorHints) {
      for (const entry of RECALL_BEHAVIOR_LEXICON) {
        if (entry.value === hint && clueHasSurface(normalizedClue, entry.surface)) {
          addSurfaceTokens(entry.surface)
        }
      }
    }
  }

  // 常见虚词（与规则 filler 对齐的一小撮），防 from/at/the / 中文指示词残留
  for (const filler of [
    'from',
    'at',
    'the',
    'a',
    'an',
    'about',
    'that',
    'this',
    'with',
    'watched',
    'watching',
    'watch',
    'viewed',
    'saved',
    '那个',
    '这个',
    '帮我找',
    '找一下',
    '我想找',
    '找找'
  ]) {
    blocklist.add(filler)
  }

  return terms.filter(term => !blocklist.has(term))
}
