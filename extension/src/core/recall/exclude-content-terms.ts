/**
 * 线索内明确排除约束（excludeContentTerms）。
 * 语义：用户**明确要求不要**的内容词面；与 dismiss/Outcome 反馈否定分计。
 * 执行：候选对任一有效排除词有库内词面命中 → **硬过滤**（见 filterMatchesByExcludeContentTerms）。
 *
 * 匹配契约（exclude 专用 · **不正**用 content 佐证的裸 includes）：
 * - 字段按 `[^a-z0-9]+` 切分（连字符为边界：day-hike → day + hike）
 * - 单词排除项：token 等于 term / 其屈折，或 token 的屈折集与排除屈折集相交
 *   （hiking→hike 命中；hikers→hiker 不与 hike 相交 → 不误杀）
 * - 连字符短语：连续 token 对齐各段（day-hike ≡ day hike）
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'
import {
  collectFilterIndexFields,
  latinInflectionVariants,
  normalizeRecallText
} from '@/core/recall/keyword-filter'

/** 与 parse-recall-clue.extractContentTerms 同形的轻量拆词（避免循环依赖）。 */
function extractTermsFromSpan(span: string): string[] {
  const normalized = normalizeRecallText(span)
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

/**
 * 否定标记：可进残留 token，但**禁止**当正向 contentTerms，也禁止单独构成 exclude。
 */
export const NEGATION_MARKER_TERMS = new Set([
  'not',
  'dont',
  "don't",
  'except',
  'without',
  'rather',
  'than'
])

/**
 * 过泛排除词：硬过滤时忽略，降低误杀（如单独 day / one）。
 * 不删用户意图里的复合词（day-hike 仍保留）。
 */
const EXCLUDE_TOO_GENERIC_TERMS = new Set([
  'day',
  'one',
  'ones',
  'thing',
  'things',
  'stuff',
  'item',
  'items',
  'page',
  'pages',
  'note',
  'notes',
  'that',
  'this',
  'those',
  'these',
  'other',
  'another',
  'some',
  'any',
  'all',
  'just',
  'only'
])

/**
 * 不确定 / 元确认：含否定词面但**不是**内容排除。
 * 命中时：不抽 excludeContentTerms；仅剥否定标记出 contentTerms。
 */
const UNCERTAIN_NEGATION_PATTERNS: RegExp[] = [
  /\bnot sure\b/i,
  /\bnot really sure\b/i,
  /\bi(?:'m| am) not sure\b/i,
  /\bi don't (?:know|remember)\b/i,
  /\bi do not (?:know|remember)\b/i,
  /\bdon't (?:know|remember)\b/i,
  /\bdo not (?:know|remember)\b/i,
  /\bmaybe not\b/i,
  /\bnot sure if\b/i
]

/**
 * 明确排除跨度（保守 · 仅高置信表面）。
 * 捕获组 = 被排除的名词短语；无法匹配则**不猜**排除范围。
 */
const EXPLICIT_EXCLUDE_SPAN_PATTERNS: RegExp[] = [
  /,\s*not the\s+(.+)$/i,
  /\bnot the\s+(.+)$/i,
  /\bnot a\s+(.+)$/i,
  /\bnot an\s+(.+)$/i,
  /\bexcept(?:\s+for)?\s+the\s+(.+)$/i,
  /\brather than\s+(?:the\s+)?(.+)$/i,
  /\bdon'?t want\s+(?:the\s+)?(.+)$/i,
  /\bdo not want\s+(?:the\s+)?(.+)$/i
]

/** 规范化排除词：去空、去重、剥否定标记与过泛词。 */
export function normalizeExcludeContentTerms(terms: readonly string[] | undefined): string[] {
  if (!terms || terms.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of terms) {
    const normalized = normalizeRecallText(term)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    if (NEGATION_MARKER_TERMS.has(normalized)) {
      continue
    }
    if (EXCLUDE_TOO_GENERIC_TERMS.has(normalized)) {
      continue
    }
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

/** 从 contentTerms 去掉否定标记（规则/映射共用）。 */
export function stripNegationMarkersFromContentTerms(terms: readonly string[]): string[] {
  return terms.filter(term => {
    const normalized = normalizeRecallText(term)
    return Boolean(normalized) && !NEGATION_MARKER_TERMS.has(normalized)
  })
}

/** 正向 contentTerms 去重归一（不剥弱偏好残留；那是 Filter/佐证门的事）。 */
function dedupeNormalizedTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of terms) {
    const normalized = normalizeRecallText(term)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

/**
 * 正向 / 排除冲突：同词不得双挂。
 * 策略：共享词**保留在 contentTerms、移出 exclude**（降低硬过滤误杀主题锚）。
 */
export function reconcilePositiveAndExcludeTerms(input: {
  contentTerms: readonly string[]
  excludeContentTerms: readonly string[]
}): { contentTerms: string[]; excludeContentTerms: string[] } {
  const contentTerms = dedupeNormalizedTerms(
    stripNegationMarkersFromContentTerms(input.contentTerms)
  )
  const excludeRaw = normalizeExcludeContentTerms(input.excludeContentTerms)
  const contentSet = new Set(contentTerms)
  const excludeContentTerms = excludeRaw.filter(term => !contentSet.has(term))
  return { contentTerms, excludeContentTerms }
}

/** 线索是否为不确定/元确认否定（不抽 exclude）。 */
export function isUncertainNegationClue(clue: string): boolean {
  const normalized = normalizeRecallText(clue)
  if (!normalized) {
    return false
  }
  return UNCERTAIN_NEGATION_PATTERNS.some(pattern => pattern.test(normalized))
}

/**
 * 规则降级：仅在高置信表面抽出 exclude；否则只剥否定标记、不发明排除范围。
 */
export function extractRuleExcludeContentTerms(clue: string): {
  excludeContentTerms: string[]
  /** 命中明确排除跨度时，跨度原文（已归一），供从正词侧扣除 */
  excludeSpanNormalized: string | null
  /** 排除标记在归一化线索中的起始下标；共享主题词若出现在此前则保留正词 */
  excludeMarkerStart: number | null
  mode: 'explicit_span' | 'uncertain_no_exclude' | 'markers_only'
} {
  const normalized = normalizeRecallText(clue)
  if (!normalized) {
    return {
      excludeContentTerms: [],
      excludeSpanNormalized: null,
      excludeMarkerStart: null,
      mode: 'markers_only'
    }
  }

  if (isUncertainNegationClue(normalized)) {
    return {
      excludeContentTerms: [],
      excludeSpanNormalized: null,
      excludeMarkerStart: null,
      mode: 'uncertain_no_exclude'
    }
  }

  for (const pattern of EXPLICIT_EXCLUDE_SPAN_PATTERNS) {
    const match = pattern.exec(normalized)
    const span = match?.[1]?.trim()
    if (!span || match?.index === undefined) {
      continue
    }
    const terms = normalizeExcludeContentTerms(extractTermsFromSpan(span))
    if (terms.length === 0) {
      continue
    }
    return {
      excludeContentTerms: terms,
      excludeSpanNormalized: normalizeRecallText(span),
      excludeMarkerStart: match.index,
      mode: 'explicit_span'
    }
  }

  return {
    excludeContentTerms: [],
    excludeSpanNormalized: null,
    excludeMarkerStart: null,
    mode: 'markers_only'
  }
}

function termAppearsBeforeIndex(
  normalizedClue: string,
  beforeIndex: number,
  term: string
): boolean {
  if (beforeIndex <= 0) {
    return false
  }
  const head = normalizedClue.slice(0, beforeIndex)
  const compactHead = head.replace(/[^a-z0-9\u3400-\u9fff]+/g, '')
  const compactTerm = term.replace(/[^a-z0-9\u3400-\u9fff]+/g, '')
  if (compactTerm.length >= 2 && compactHead.includes(compactTerm)) {
    return true
  }
  return new RegExp(
    `(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`
  ).test(head)
}

/**
 * 规则路径：在已抽 contentTerms 上应用排除抽取 + 冲突消解。
 */
export function applyRuleExcludeToContentTerms(
  clue: string,
  contentTerms: readonly string[]
): { contentTerms: string[]; excludeContentTerms: string[] } {
  const normalizedClue = normalizeRecallText(clue)
  const extracted = extractRuleExcludeContentTerms(normalizedClue)
  let nextContent = stripNegationMarkersFromContentTerms(contentTerms)

  if (
    extracted.mode === 'explicit_span' &&
    extracted.excludeSpanNormalized &&
    extracted.excludeMarkerStart !== null
  ) {
    const spanTerms = new Set(
      normalizeExcludeContentTerms(extractTermsFromSpan(extracted.excludeSpanNormalized))
    )
    nextContent = nextContent.filter(term => {
      const normalized = normalizeRecallText(term)
      if (!spanTerms.has(normalized)) {
        return true
      }
      // 排除跨度与正侧共享的主题词：若出现在排除标记之前，保留正词
      return termAppearsBeforeIndex(normalizedClue, extracted.excludeMarkerStart!, normalized)
    })
  }

  return reconcilePositiveAndExcludeTerms({
    contentTerms: nextContent,
    excludeContentTerms: extracted.excludeContentTerms
  })
}

/** 字段 → 小写字母数字 token（`-` / 空白 / 标点均为边界）。 */
export function tokenizeForExcludeMatch(text: string): string[] {
  const normalized = normalizeRecallText(text)
  if (!normalized.trim()) {
    return []
  }
  return normalized.split(/[^a-z0-9]+/).filter(Boolean)
}

/** 排除词自身的屈折闭包（含原词）。 */
function excludeTermVariantSet(term: string): Set<string> {
  const normalized = normalizeRecallText(term)
  const variants = new Set<string>()
  if (!normalized) {
    return variants
  }
  variants.add(normalized)
  for (const variant of latinInflectionVariants(normalized)) {
    variants.add(variant)
  }
  return variants
}

/** 字段 token 是否与排除屈折集相交（含反向：hiking 的屈折含 hike）。 */
function fieldTokenHitsExcludeVariants(fieldToken: string, excludeVariants: Set<string>): boolean {
  if (excludeVariants.has(fieldToken)) {
    return true
  }
  for (const variant of latinInflectionVariants(fieldToken)) {
    if (excludeVariants.has(variant)) {
      return true
    }
  }
  return false
}

/**
 * 单字段是否命中一个排除词（exclude 专用契约）。
 * 与正佐证 `fieldCorroboratesTerm` 分计：禁止裸 includes 子串。
 */
export function fieldHitsExcludeTerm(originalField: string, excludeTerm: string): boolean {
  const term = normalizeRecallText(excludeTerm)
  if (!term || !originalField.trim()) {
    return false
  }
  const fieldTokens = tokenizeForExcludeMatch(originalField)
  if (fieldTokens.length === 0) {
    return false
  }

  const hyphenParts = term.split(/-+/).filter(Boolean)
  if (hyphenParts.length >= 2) {
    // 连字符短语：连续 token 对齐（day-hike ≡ day hike）
    const partVariantSets = hyphenParts.map(part => excludeTermVariantSet(part))
    for (let start = 0; start <= fieldTokens.length - partVariantSets.length; start += 1) {
      const aligned = partVariantSets.every((partVariants, offset) =>
        fieldTokenHitsExcludeVariants(fieldTokens[start + offset]!, partVariants)
      )
      if (aligned) {
        return true
      }
    }
    return false
  }

  // 单词：边界 token + 双向屈折
  const excludeVariants = excludeTermVariantSet(term)
  return fieldTokens.some(token => fieldTokenHitsExcludeVariants(token, excludeVariants))
}

/** 条目索引字段是否命中给定排除词。 */
export function itemFieldTextsHitExcludeTerm(item: MemoryItem, excludeTerm: string): boolean {
  const fields = collectFilterIndexFields(item)
  return fields.some(field => fieldHitsExcludeTerm(field.text, excludeTerm))
}

/**
 * 内部诊断：规范化排除词 → 实际命中该条目的排除词列表。
 * 供区分「模型原始 / 规范化 / 生效排除 / 被滤文档」；不进产品 UI。
 */
export function listExcludeTermsHittingItem(
  item: MemoryItem,
  excludeContentTerms: readonly string[] | undefined
): string[] {
  const terms = normalizeExcludeContentTerms(excludeContentTerms)
  return terms.filter(term => itemFieldTextsHitExcludeTerm(item, term))
}

/** 条目是否命中任一有效排除词（exclude 专用匹配，非正佐证 includes）。 */
export function itemHitsExcludeContentTerms(
  item: MemoryItem,
  excludeContentTerms: readonly string[] | undefined
): boolean {
  return listExcludeTermsHittingItem(item, excludeContentTerms).length > 0
}

/**
 * 硬过滤：命中排除词面的候选一律剔除。
 * 空 exclude → 原样返回。硬过滤后空池 = 诚实空邻域（不因排除单独做 soft 回退）。
 */
export function filterMatchesByExcludeContentTerms(
  matches: RecallMatch[],
  excludeContentTerms: readonly string[] | undefined
): RecallMatch[] {
  const terms = normalizeExcludeContentTerms(excludeContentTerms)
  if (terms.length === 0) {
    return matches
  }
  return matches.filter(match => !itemHitsExcludeContentTerms(match.item, terms))
}
