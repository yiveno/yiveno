import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  isChineseYearSeasonCompound,
  isYearScaleTimeSurfaceBlockedBySeason,
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

/** 货币单位（闭类）+ bank（bank note 固定词）。 */
const CURRENCY_NOTE_PRECEDING_WORDS = [
  'pound',
  'pounds',
  'dollar',
  'dollars',
  'euro',
  'euros',
  'yen',
  'yuan',
  'franc',
  'francs',
  'rupee',
  'rupees',
  'won',
  'peso',
  'pesos',
  'bank' // bank note（纸币）固定词
] as const

/** 货币名词里的 note（如 five pound note / dollar note）不是检索词，避免误命中 NotebookLM。 */
export function dropMisleadingNoteContentTerm(normalizedClue: string, terms: string[]): string[] {
  if (!terms.includes('note')) {
    return terms
  }
  const tokens = normalizedClue.split(/[^a-z0-9]+/)
  const noteIndex = tokens.indexOf('note')
  if (noteIndex > 0) {
    const prev = tokens[noteIndex - 1]
    if (
      typeof prev === 'string' &&
      ((CURRENCY_NOTE_PRECEDING_WORDS as readonly string[]).includes(prev) || /^\d+$/.test(prev))
    ) {
      return terms.filter(term => term !== 'note')
    }
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
 * 确定性中文糊时间兜底：词典未命中且模型未给 label 时补槽。
 * 之前/以前/上次 → a_while_ago；去年/前年/去年或前年 → long_ago（季节复合除外）。
 */
function groundFuzzyChineseTimeFallback(
  normalizedClue: string
): RecallRelativeTimeLabel | undefined {
  if (/去年或前年/.test(normalizedClue) && !isChineseYearSeasonCompound(normalizedClue)) {
    return 'long_ago'
  }
  if (
    /前年/.test(normalizedClue) &&
    !/(?:前年)(?:春天|夏天|秋天|冬天|[春夏秋冬])/.test(normalizedClue)
  ) {
    return 'long_ago'
  }
  if (
    /去年/.test(normalizedClue) &&
    !/(?:去年)(?:春天|夏天|秋天|冬天|[春夏秋冬])/.test(normalizedClue)
  ) {
    return 'long_ago'
  }
  if (/之前|以前|上次/.test(normalizedClue)) {
    return 'a_while_ago'
  }
  return undefined
}

/**
 * 时间标签：若线索命中词典词面，优先用最长 surface 对应 label（纠偏 LLM 的 recent/a_while_ago 混淆）。
 * 无线索词面时才回退模型提议；再无则中文糊时间兜底。
 * 仅有公历年份或 soft「old」、无相对时间词面时，丢弃模型 timeLabel。
 */
export function groundTimeLabel(
  clue: string,
  proposed: RecallRelativeTimeLabel | null | undefined
): RecallRelativeTimeLabel | undefined {
  const normalized = normalizeRecallText(clue)
  const hits = RECALL_TIME_LEXICON.filter(
    entry =>
      clueHasSurface(normalized, entry.surface) &&
      !isYearScaleTimeSurfaceBlockedBySeason(entry.surface, normalized)
  ).sort((a, b) => b.surface.length - a.surface.length)
  if (hits[0]) {
    return hits[0].value
  }
  if (shouldRejectProposedTimeLabelWithoutLexicon(normalized, proposed)) {
    return undefined
  }
  if (proposed) {
    return proposed
  }
  return groundFuzzyChineseTimeFallback(normalized)
}

/**
 * 形式不确定套话：用户明示「可能是 A 也可能是 B / 视频还是文章」等 → 不标 objectTypes。
 * 整类机制；命中后清空提议与词典补全。
 */
const OBJECT_TYPE_FORM_UNCERTAINTY_PATTERNS: readonly RegExp[] = [
  /可能是.{0,16}也可能是/,
  /也许是.{0,16}(也许是|或者是|还是)/,
  /不知道是.{0,12}还是/,
  /视频还是文章|文章还是视频|视频或者文章|文章或者视频/,
  /具体形式(不明|不清楚|不确定)?/,
  /什么形式/,
  /maybe (?:a |an )?(?:video|article|song|post).{0,24}(?:or|maybe)/i,
  /(?:video|article|song).{0,16}(?:or|\/).{0,8}(?:video|article|song)/i
]

/** page 强表面：明确把「网站/webpage」当要找的对象形态（弱「页面/网页/page」不够）。 */
const STRONG_PAGE_SURFACES = ['网站', 'website', 'webpage', 'web page'] as const

/** 线索是否明示对象形态不确定。 */
export function clueHasObjectTypeFormUncertainty(clue: string): boolean {
  const normalized = normalizeRecallText(clue)
  return OBJECT_TYPE_FORM_UNCERTAINTY_PATTERNS.some(pattern => pattern.test(normalized))
}

/** page 是否有足够强的形态证据（排除弱场景名词）。 */
function hasStrongPageEvidence(normalizedClue: string): boolean {
  return STRONG_PAGE_SURFACES.some(surface => clueHasSurface(normalizedClue, surface))
}

/** 某类型在线索中是否有可用词面支撑（page 另走强证据）。 */
function hasObjectTypeSurfaceEvidence(normalizedClue: string, type: RecallObjectType): boolean {
  if (type === 'page') {
    return hasStrongPageEvidence(normalizedClue)
  }
  return RECALL_OBJECT_TYPE_LEXICON.some(
    entry => entry.value === type && clueHasSurface(normalizedClue, entry.surface)
  )
}

/**
 * 只保留线索中确有词典词面支撑的对象类型；词面命中时可补全模型漏提的类型。
 * - 形式不确定套话 → 整槽留空（不猜、不堆叠）
 * - page 仅认强表面（网站/website/webpage）；弱「页面/网页/page」不撑类型、不自动补
 */
export function groundObjectTypes(
  clue: string,
  types: RecallObjectType[] | undefined
): RecallObjectType[] | undefined {
  const normalized = normalizeRecallText(clue)
  if (clueHasObjectTypeFormUncertainty(normalized)) {
    return undefined
  }

  const kept = new Set<RecallObjectType>()

  for (const type of types ?? []) {
    if (hasObjectTypeSurfaceEvidence(normalized, type)) {
      kept.add(type)
    }
  }

  // 规则词典词面命中也补上（模型漏提 bookmark / article 时）；page 弱表面不走此路
  for (const entry of RECALL_OBJECT_TYPE_LEXICON) {
    if (entry.value === 'page') {
      continue
    }
    if (clueHasSurface(normalized, entry.surface)) {
      kept.add(entry.value)
    }
  }

  // page：仅强表面（网站/website/webpage）可自动补；弱「页面/网页/page」不够
  if (hasStrongPageEvidence(normalized)) {
    kept.add('page')
  }

  return kept.size > 0 ? [...kept] : undefined
}

/**
 * 闭集平台/渠道词面（来源实体，非内容同义灰名单）。
 * clue 中出现则须稳定保留进 contentTerms，避免被主题词挤掉。
 * 表面即 token；中英并列只为同一渠道的常见写法，不做开放同义扩词。
 */
export const RECALL_PLATFORM_CHANNEL_SURFACES = [
  '公众号',
  '微信公众号',
  '抖音',
  'douyin',
  'tiktok',
  '小红书',
  'xiaohongshu',
  'b站',
  'bilibili',
  '哔哩哔哩',
  '知乎',
  'zhihu',
  'youtube',
  '微博',
  'weibo'
] as const

/**
 * 把 clue 中已出现的平台/渠道表面补进 contentTerms（模型漏抽时确定性补回）。
 * 不发明线索里没有的渠道名。
 */
export function preservePlatformChannelTerms(clue: string, terms: string[]): string[] {
  const normalized = normalizeRecallText(clue)
  const out = [...terms]
  const seen = new Set(out)
  // 长表面优先，避免「微信公众号」只留下更短残片策略不一致
  const surfaces = [...RECALL_PLATFORM_CHANNEL_SURFACES].sort((a, b) => b.length - a.length)
  for (const surface of surfaces) {
    if (!clueHasSurface(normalized, surface)) {
      continue
    }
    const token = normalizeRecallText(surface)
    if (!token || seen.has(token)) {
      continue
    }
    // 若更长表面已写入（微信公众号），跳过被其包含的短表面重复（公众号仍可单独命中 clue）
    seen.add(token)
    out.push(token)
  }
  return out
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
