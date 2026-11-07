import type { MemoryItem } from '@/core/memory/memory-item'
import { isShellBookmarkTitle, weakAnchorScorePenalty } from '@/core/memory/corpus-quality-gate'
import type { RecallMatch } from '@/core/recall/recall-result'
import {
  CONTENT_COVERAGE_RATIO_SCALE,
  CONTENT_COVERAGE_TERM_MIN_LEN,
  CONTENT_MULTI_TERM_HIT_BONUS,
  FIELD_WEIGHTS,
  FUZZY_SCORE_FACTOR,
  NGRAM_FIELD_BONUS,
  NGRAM_SCORE_FACTOR,
  NOTE_COVERAGE_TERM_MIN_LEN,
  NOTE_MULTI_TERM_HIT_BONUS,
  OMNIBOX_FIELD_WEIGHTS,
  PRIMARY_CONTENT_HIT_BONUS,
  PRIMARY_MATCH_QUALITY_CAP,
  RECALL_BEHAVIOR_BOOST_CAP,
  RECALL_CASE_FIT_BOOST_CAP,
  RECALL_DISMISS_PENALTY_CAP,
  RECALL_MIN_MATCH_SCORE,
  RECALL_ORTHOGRAPHIC_ACRONYM_MAX_LEN
} from '@/core/recall/keyword-filter-weights'

/** 对外仍从 keyword-filter 入口拿 Top Pick 门槛（其余权重仅本模块 + weights 内用）。 */
export { RECALL_TOP_PICK_MIN_SCORE } from '@/core/recall/keyword-filter-weights'

/**
 * 将 hyphen / underscore 折成空格（仅在 ASCII 词字符之间）。
 * 用于对齐「react-native」与「react native」/「reactnative」。
 * 不动非 ASCII 字符、不动 host 形式（含点的段）、不折首尾。
 *
 * `compactRecallText` 仅抹空白；若 token 是「react-native」（连字符保留），
 * 与条目 compact 后的「reactnative」或「react native」互不 substring 命中（AF-14）。
 * 本函数产出空白替换与无空白两种 variant，让查询侧召回非连字符形态条目。
 */
export function splitHyphenUnderscoreVariants(text: string): string[] {
  if (!text || !/[-_]/.test(text)) {
    return []
  }
  const isAsciiAlnum = (ch: string | undefined): boolean => {
    if (!ch) {
      return false
    }
    const code = ch.charCodeAt(0)
    return (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a)
    )
  }
  const chars = text.split('')
  const lastIndex = chars.length - 1
  const spacedChars = chars.map((ch, i) => {
    if ((ch !== '-' && ch !== '_') || i === 0 || i === lastIndex) {
      return ch
    }
    // host 含点的段：不折（避免破坏 URL 解析路径）
    if (chars[i - 1] === '.' || chars[i + 1] === '.') {
      return ch
    }
    if (isAsciiAlnum(chars[i - 1]) && isAsciiAlnum(chars[i + 1])) {
      return ' '
    }
    return ch
  })
  const spaced = spacedChars.join('')
  const noSep = spaced.replace(/\s+/g, '')
  if (noSep !== text && isUsableRecallToken(noSep)) {
    return [spaced, noSep]
  }
  return spaced !== text ? [spaced] : []
}

const DAY_MS = 24 * 60 * 60 * 1000

const PRIMARY_CONTENT_FIELDS = new Set(['title', 'textExcerpt', 'note'])

/**
 * 口语泛词：单独出现时不具唯一锚点，不得仅凭 pageTitle 抬 Top1。
 * 产品面仅英文；非语种停用词表，只挡 Recall 假阳性。
 */
export const RECALL_GENERIC_CLUE_TERMS = new Set([
  'review',
  'reviews',
  'movie',
  'movies',
  'film',
  'films',
  'saved',
  'save',
  'note',
  'notes',
  'article',
  'articles',
  'page',
  'site',
  'link',
  'links',
  'bookmark',
  'bookmarks',
  'morning',
  'evening',
  'today',
  'yesterday',
  'week',
  'thing',
  'things',
  'stuff',
  'something',
  'anything',
  'post',
  'posts',
  'blog',
  'video',
  'videos',
  'read',
  'reading',
  'just',
  'recent',
  'recently',
  'last',
  'latest'
])

interface FilterIndexField {
  field: string
  text: string
}

/** Filter 分词种类。 */
type TokenKind =
  | 'phrase' // 短语
  | 'term' // 单词
  | 'ngram' // n-gram 片段

interface RecallToken {
  token: string
  kind: TokenKind
}

/**
 * 行为加权档位。
 * - default：Side Panel / 通用（裸 open 偏低，防连环排查污染）
 * - omnibox：快跳略抬 open / 近因 / settled（仍受 {@link RECALL_BEHAVIOR_BOOST_CAP}）
 */
/**
 * 召回打分行为档。
 * - default：Side Panel / 完整轨
 * - omnibox：地址栏轨（更偏本地 / 词面）
 */
export type RecallBehaviorProfile =
  | 'default' // Side Panel 默认
  | 'omnibox' // Omnibox

/** 打分可选时钟（eval 固定 now，避免近因漂移）与行为档。 */
export interface RecallScoreOptions {
  nowMs?: number
  behaviorProfile?: RecallBehaviorProfile
}

/** 归一化筛选文本。 */
export function normalizeRecallText(text: string): string {
  return text.trim().toLowerCase()
}

/** 去掉空白，便于「Yiveno产品」对上「Yiveno 产品」。 */
export function compactRecallText(text: string): string {
  return normalizeRecallText(text).replace(/\s+/g, '')
}

/** 是否像 host / URL 线索 token（含 TLD 或路径）。 */
export function looksLikeRecallHostClue(token: string): boolean {
  const host = normalizeRecallText(token).split('/')[0] ?? ''
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(host)
}

/** 去掉 host 前缀 www.（仅 host 对齐，不改路径）。 */
export function stripRecallHostWwwPrefix(host: string): string {
  const normalized = normalizeRecallText(host)
  return normalized.startsWith('www.') ? normalized.slice(4) : normalized
}

/**
 * host 线索变体：裸域 ↔ www.，便于 domain/url 字段对齐。
 * 例：rottentomatoes.com ↔ www.rottentomatoes.com
 */
export function expandRecallHostClueVariants(token: string): string[] {
  const normalized = normalizeRecallText(token).trim()
  if (!normalized || !looksLikeRecallHostClue(normalized)) {
    return normalized ? [normalized] : []
  }

  const variants = new Set<string>([normalized])
  const slashIndex = normalized.indexOf('/')
  const host = slashIndex >= 0 ? normalized.slice(0, slashIndex) : normalized
  const pathSuffix = slashIndex >= 0 ? normalized.slice(slashIndex) : ''

  if (host.startsWith('www.')) {
    const bareHost = host.slice(4)
    variants.add(`${bareHost}${pathSuffix}`)
  } else {
    variants.add(`www.${host}${pathSuffix}`)
  }

  return [...variants]
}

function pushRecallHostClueVariants(sink: Map<string, TokenKind>): void {
  for (const [token, kind] of [...sink.entries()]) {
    if (kind === 'ngram') {
      continue
    }
    for (const variant of expandRecallHostClueVariants(token)) {
      if (!isUsableRecallToken(variant) || sink.has(variant)) {
        continue
      }
      sink.set(variant, kind === 'phrase' ? 'term' : kind)
    }
  }
}

/** 短字符串编辑距离（仅用于短 token 模糊）。 */
export function recallEditDistance(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  if (left.length === 0) {
    return right.length
  }
  if (right.length === 0) {
    return left.length
  }

  const rows = left.length + 1
  const cols = right.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  )

  for (let i = 0; i < rows; i += 1) {
    matrix[i]![0] = i
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0]![j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      )
    }
  }

  return matrix[left.length]![right.length]!
}

/** 紧凑文本中是否存在与 needle 编辑距离 ≤ maxDistance 的窗口。 */
export function hasFuzzySubstring(haystack: string, needle: string, maxDistance = 1): boolean {
  if (!needle || !haystack) {
    return false
  }
  if (haystack.includes(needle)) {
    return true
  }
  if (needle.length < 2 || needle.length > 12) {
    return false
  }

  const minLen = Math.max(1, needle.length - maxDistance)
  const maxLen = needle.length + maxDistance
  for (let len = minLen; len <= maxLen; len += 1) {
    if (len > haystack.length) {
      continue
    }
    for (let start = 0; start + len <= haystack.length; start += 1) {
      if (recallEditDistance(haystack.slice(start, start + len), needle) <= maxDistance) {
        return true
      }
    }
  }
  return false
}

/**
 * 线索 token 是否可检索。
 * ASCII 单字母/数字过噪（如 `a`）丢弃；汉字等非 ASCII 单字保留（「红」应能命中「红井」）。
 */
export function isUsableRecallToken(token: string): boolean {
  const chars = Array.from(token)
  if (chars.length === 0) {
    return false
  }
  if (chars.length >= 2) {
    return true
  }
  const ch = chars[0]!
  return ch.charCodeAt(0) > 0x7f
}

/**
 * 从无空格的连续文字段提取 token（脚本无关策略）：
 * - 整段作为 term（限长；含单字）
 * - 仅首尾 2-gram，避免中间切字噪声（不依赖语种词表）
 */
function pushUnspacedScriptTokens(segment: string, sink: Map<string, TokenKind>): void {
  const chars = Array.from(segment)
  if (chars.length === 0) {
    return
  }

  if (chars.length === 1) {
    if (isUsableRecallToken(segment)) {
      sink.set(segment, sink.get(segment) === 'ngram' ? 'ngram' : 'term')
    }
    return
  }

  if (chars.length <= 16) {
    sink.set(segment, sink.get(segment) === 'ngram' ? 'ngram' : 'term')
  }

  if (chars.length === 2) {
    return
  }

  const head = chars.slice(0, 2).join('')
  const tail = chars.slice(-2).join('')
  if (!sink.has(head)) {
    sink.set(head, 'ngram')
  }
  if (!sink.has(tail)) {
    sink.set(tail, 'ngram')
  }
}

/**
 * 将线索拆分为可匹配 token（不维护语种停用词表）。
 * - 保留整句 / 空白与标点分词
 * - 抽出拉丁数字词
 * - 无空格连续非 ASCII 段：整段（含单字）+ 首尾 2-gram
 */
export function tokenizeRecallClueDetailed(clue: string): RecallToken[] {
  const normalized = normalizeRecallText(clue)
  if (!normalized) {
    return []
  }

  const byToken = new Map<string, TokenKind>()
  const compactClue = compactRecallText(clue)

  if (isUsableRecallToken(normalized)) {
    byToken.set(normalized, 'phrase')
    if (compactClue !== normalized && isUsableRecallToken(compactClue)) {
      byToken.set(compactClue, 'phrase')
    }
  }

  for (const part of normalized.split(/[\s,，、；;|/]+/)) {
    const token = part.trim()
    if (!isUsableRecallToken(token)) {
      continue
    }
    byToken.set(token, byToken.get(token) === 'phrase' ? 'phrase' : 'term')
  }

  for (const match of compactClue.match(/[a-z0-9][a-z0-9._:+-]{1,47}/gi) ?? []) {
    const token = match.toLowerCase()
    if (token.length >= 2) {
      byToken.set(token, byToken.get(token) === 'phrase' ? 'phrase' : 'term')
      // Hyphen / underscore 之间折：让查询侧「react-native」同时对齐「react native」「reactnative」。
      for (const variant of splitHyphenUnderscoreVariants(token)) {
        if (!isUsableRecallToken(variant) || byToken.has(variant)) {
          continue
        }
        byToken.set(variant, 'term')
        // 「react native」折出 "react" 和 "native" 子串，后续 split 会再处理
        for (const part of variant.split(/\s+/)) {
          if (isUsableRecallToken(part) && !byToken.has(part)) {
            byToken.set(part, 'term')
          }
        }
      }
    }
  }

  for (const match of compactClue.match(/[^\s\x00-\x7f]{1,24}/g) ?? []) {
    pushUnspacedScriptTokens(match, byToken)
  }

  pushRecallHostClueVariants(byToken)

  return [...byToken.entries()].map(([token, kind]) => ({ token, kind }))
}

/** 将线索拆分为 token 字符串（兼容解释层与既有测试）。 */
export function tokenizeRecallClue(clue: string): string[] {
  return tokenizeRecallClueDetailed(clue).map(entry => entry.token)
}

/** 收集 MemoryItem 的可匹配字段（关键词 Filter）；按 field+紧凑文本去重。 */
export function collectFilterIndexFields(item: MemoryItem): FilterIndexField[] {
  const fields: FilterIndexField[] = []
  const seen = new Set<string>()
  const { clues } = item

  const push = (field: string, text: string | undefined | null): void => {
    if (!text) {
      return
    }
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }
    const key = `${field}\0${compactRecallText(trimmed)}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    fields.push({ field, text: trimmed })
  }

  push('textExcerpt', clues.textExcerpt)
  push('summary', clues.summary)
  push('domain', clues.domain)
  push('url', clues.sourceUrl)
  push('note', clues.note)
  if (clues.keywords.length > 0) {
    push('keywords', clues.keywords.join(' '))
  }
  if (clues.tags.length > 0) {
    push('tags', clues.tags.join(' '))
  }

  if (item.type === 'bookmark') {
    // 空壳标题（= URL/域名回显）不再当高权 title 字段，只保留 url/domain，避免假装「有标题」
    const bookmarkTitle = (clues.title ?? item.payload.title).trim()
    if (
      bookmarkTitle &&
      !isShellBookmarkTitle(bookmarkTitle, item.payload.url, item.payload.domain)
    ) {
      push('title', clues.title)
      push('title', item.payload.title)
    }
    push('url', item.payload.url)
    push('domain', item.payload.domain)
  } else {
    // 摘录无独立标题；pageTitle / clues.title 均为出处页名
    push('pageTitle', clues.title)
    push('pageTitle', item.payload.pageTitle)
    push('textExcerpt', item.payload.selectedText)
    push('url', item.payload.sourceUrl)
    push('domain', item.payload.domain)
    // 前后文合并为单一弱字段，避免 Before+After 双计压过正文
    const contextParts = [item.payload.contextBefore, item.payload.contextAfter]
      .map(part => part?.trim())
      .filter((part): part is string => Boolean(part && part.length > 0))
    if (contextParts.length > 0) {
      push('excerptContext', contextParts.join('\n'))
    }
  }

  return fields
}

function fieldWeight(field: string, profile: RecallBehaviorProfile = 'default'): number {
  const table = profile === 'omnibox' ? OMNIBOX_FIELD_WEIGHTS : FIELD_WEIGHTS
  return table[field] ?? 8
}

/**
 * 拉丁词轻量屈折变体（无词典）：disagreed↔disagree、clients↔client。
 * 仅 ASCII 字母；变体过短则丢弃。
 */
export function latinInflectionVariants(token: string): string[] {
  const normalized = normalizeRecallText(token)
  if (normalized.length < 4 || !/^[a-z]+$/.test(normalized)) {
    return normalized ? [normalized] : []
  }

  const variants = new Set<string>([normalized])
  if (normalized.endsWith('ies') && normalized.length >= 5) {
    variants.add(`${normalized.slice(0, -3)}y`)
  }
  if (normalized.endsWith('es') && normalized.length >= 5 && !normalized.endsWith('ss')) {
    variants.add(normalized.slice(0, -2))
  }
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length >= 4) {
    variants.add(normalized.slice(0, -1))
  }
  if (normalized.endsWith('ing') && normalized.length >= 6) {
    const base = normalized.slice(0, -3)
    variants.add(base)
    variants.add(`${base}e`)
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      variants.add(base.slice(0, -1))
    }
  }
  if (normalized.endsWith('ed') && normalized.length >= 5) {
    // disagreed → disagree（去 d）；liked → like（去 ed + e）
    variants.add(normalized.slice(0, -1))
    variants.add(normalized.slice(0, -2))
    variants.add(`${normalized.slice(0, -2)}e`)
  }

  return [...variants].filter(variant => variant.length >= 3)
}

function exactTokenHit(
  fieldText: string,
  compactField: string,
  token: string,
  /** 预计算的 compact，避免同一 token 对每字段重复 compactRecallText。 */
  compactToken: string,
  /** 原文（保留大小写）；供 CamelCase 缩写匹配 */
  originalField = ''
): boolean {
  if (fieldText.includes(token) || compactField.includes(token)) {
    return true
  }
  if (compactToken.length >= 2 && compactField.includes(compactToken)) {
    return true
  }
  // 短词：原文形态缩写（JavaScript→js；React Native→rn）
  if (shortLatinTokenHitsField(originalField || fieldText, token)) {
    return true
  }
  // 拉丁屈折：线索 disagreed 对齐字段 disagree（通解，非专名表）
  for (const variant of latinInflectionVariants(token)) {
    if (variant === token) {
      continue
    }
    if (fieldText.includes(variant) || compactField.includes(compactRecallText(variant))) {
      return true
    }
  }
  // host 对齐：www. 与裸域等价（domain / url 字段常见形态差）
  if (looksLikeRecallHostClue(compactToken)) {
    const tokenHost = stripRecallHostWwwPrefix(compactToken.split('/')[0] ?? compactToken)
    const fieldHost = stripRecallHostWwwPrefix(compactField.split('/')[0] ?? compactField)
    if (tokenHost.length >= 4 && fieldHost.includes(tokenHost)) {
      return true
    }
    if (tokenHost.length >= 4 && stripRecallHostWwwPrefix(compactField).includes(tokenHost)) {
      return true
    }
  }
  return false
}

/** 从 CamelCase / PascalCase 词抽取首字母缩写（JavaScript → js）。 */
export function camelCaseAcronym(word: string): string {
  const parts = word.split(/(?=[A-Z])/).filter(part => part.length > 0)
  if (parts.length < 2) {
    return ''
  }
  return parts.map(part => part[0]?.toLowerCase() ?? '').join('')
}

/**
 * 从原文抽取形态缩写（无词典）：
 * - 单词语 CamelCase / PascalCase / 连续大写（JavaScript→js，CSS→css）
 * - 连续 2–3 个拉丁词的首字母（React Native→rn）
 * 仅保留长度 ∈ [2, {@link RECALL_ORTHOGRAPHIC_ACRONYM_MAX_LEN}]。
 */
export function extractOrthographicAcronyms(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (acronym: string): void => {
    if (
      acronym.length < 2 ||
      acronym.length > RECALL_ORTHOGRAPHIC_ACRONYM_MAX_LEN ||
      seen.has(acronym)
    ) {
      return
    }
    seen.add(acronym)
    out.push(acronym)
  }

  const words = text.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []
  for (const word of words) {
    push(camelCaseAcronym(word))
  }
  for (let index = 0; index < words.length; index += 1) {
    for (const windowSize of [2, 3] as const) {
      if (index + windowSize > words.length) {
        continue
      }
      const acronym = words
        .slice(index, index + windowSize)
        .map(word => word[0]?.toLowerCase() ?? '')
        .join('')
      push(acronym)
    }
  }
  return out
}

/**
 * 短拉丁 token 是否命中字段原文形态缩写（JavaScript→js；React Native→rn）。
 * 不做民间缩写词典；全小写整词推不出的残差交给字面 / Hybrid。
 */
function shortLatinTokenHitsField(originalField: string, token: string): boolean {
  if (token.length < 2 || token.length > RECALL_ORTHOGRAPHIC_ACRONYM_MAX_LEN) {
    return false
  }
  if (!/^[a-z][a-z0-9]*$/i.test(token)) {
    return false
  }
  const needle = token.toLowerCase()
  return extractOrthographicAcronyms(originalField).some(
    acronym => acronym === needle || acronym.startsWith(needle)
  )
}

function scoreFactorForKind(kind: TokenKind): number {
  if (kind === 'ngram') {
    return NGRAM_SCORE_FACTOR
  }
  return 1
}

/**
 * 行为加权：仅在已有词面命中时使用。
 * - openCount：explore「看过」（默认偏低；omnibox 略抬）
 * - settledCount：§7.2 履约正例（常开/确认过的记忆；此前未进本函数）
 * - 近 7/30 天 lastOpenedAt：近因
 * 总和封顶 {@link RECALL_BEHAVIOR_BOOST_CAP}，不得压过强词面差。
 */
export function computeBehaviorBoost(item: MemoryItem, options: RecallScoreOptions = {}): number {
  const omnibox = options.behaviorProfile === 'omnibox'
  const openCount = item.clues.openCount ?? 0
  const settledCount = item.clues.settledCount ?? 0

  // §7.2：裸 open 易被连环排查污染；默认仍偏低。Omnibox 快跳略抬（常开的应更靠前）。
  const openBoost =
    openCount > 0
      ? Math.min(omnibox ? 6 : 4, Math.floor(Math.log2(openCount + 1) * (omnibox ? 2.2 : 1.5)))
      : 0

  // settled = 用户确认过的「就是这条」信号，须明显大于同量级裸 open（防词面微差盖过）
  const settledBoost =
    settledCount > 0
      ? Math.min(omnibox ? 8 : 5, Math.floor(Math.log2(settledCount + 1) * (omnibox ? 3 : 2)))
      : 0

  let recencyBoost = 0
  const lastOpenedAt = item.clues.lastOpenedAt
  if (lastOpenedAt) {
    const openedMs = Date.parse(lastOpenedAt)
    if (!Number.isNaN(openedMs)) {
      const ageMs = (options.nowMs ?? Date.now()) - openedMs
      if (ageMs >= 0 && ageMs <= 7 * DAY_MS) {
        recencyBoost = omnibox ? 5 : 4
      } else if (ageMs >= 0 && ageMs <= 30 * DAY_MS) {
        recencyBoost = omnibox ? 3 : 2
      }
    }
  }

  return Math.min(RECALL_BEHAVIOR_BOOST_CAP, openBoost + settledBoost + recencyBoost)
}

/**
 * 从线索抽出「带大小写偏好」的拉丁词。
 * 全小写 token 不收录——用户未表达大小写偏好，不加分。
 */
export function extractCasedClueTokens(clue: string): string[] {
  const trimmed = clue.trim()
  if (!trimmed) {
    return []
  }

  const matches = trimmed.match(/[A-Za-z][A-Za-z0-9._:+-]{1,47}/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of matches) {
    if (match === match.toLowerCase()) {
      continue
    }
    const key = match.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(match)
  }
  return out
}

/**
 * 大小写贴合软加权：词面已命中后，主文原文与线索大小写一致则微抬。
 * - 忽略大小写仍负责能否命中
 * - 线索全小写 → 0（无偏好）
 * - 仅看 title / 摘录正文 / note
 */
export function computeCaseFitBoost(
  clue: string,
  primaryFieldOriginals: readonly string[]
): number {
  const casedTokens = extractCasedClueTokens(clue)
  if (casedTokens.length === 0 || primaryFieldOriginals.length === 0) {
    return 0
  }

  let total = 0
  for (const token of casedTokens) {
    let tokenGain = 0
    const tokenLower = token.toLowerCase()
    for (const field of primaryFieldOriginals) {
      const fieldLower = field.toLowerCase()
      let from = 0
      while (from < fieldLower.length) {
        const idx = fieldLower.indexOf(tokenLower, from)
        if (idx < 0) {
          break
        }
        const slice = field.slice(idx, idx + token.length)
        if (slice === token) {
          // 完整大小写一致：长度略加权，单 token 上限 6
          tokenGain = Math.max(
            tokenGain,
            Math.min(6, 3 + Math.min(3, Math.max(0, token.length - 2)))
          )
        }
        from = idx + 1
      }
    }
    total += tokenGain
  }

  return Math.min(RECALL_CASE_FIT_BOOST_CAP, total)
}

/**
 * 否定降权：用户点过「都不是这些」后压低该项。
 * log2 压缩，封顶 RECALL_DISMISS_PENALTY_CAP。
 */
export function computeDismissPenalty(item: MemoryItem): number {
  const dismissCount = item.clues.dismissCount ?? 0
  if (dismissCount <= 0) {
    return 0
  }
  return Math.min(RECALL_DISMISS_PENALTY_CAP, Math.floor(Math.log2(dismissCount + 1) * 4))
}

/** 码点长度（不按语种分词；emoji / 组合字符比 `string.length` 更稳）。 */
export function recallCodePointLength(text: string): number {
  return Array.from(text).length
}

/**
 * 主文贴合度（语言无关）：
 * - 密度：命中片段占字段比例
 * - 起首：字段以命中片段开头
 * - 近全等：字段几乎等于命中片段
 * 不依赖某一语种的词法/词典。
 */
export function computePrimaryMatchQualityBoost(
  tokens: Array<{ token: string; kind: TokenKind; compactToken?: string }>,
  primaryCompacts: string[]
): number {
  if (primaryCompacts.length === 0) {
    return 0
  }

  // 每个 token 只 compact 一次（外层字段循环会反复用到）
  const prepared = tokens
    .filter(entry => entry.kind !== 'ngram')
    .map(entry => ({
      compactToken: entry.compactToken ?? compactRecallText(entry.token)
    }))

  let best = 0

  for (const fieldCompact of primaryCompacts) {
    const fieldLen = recallCodePointLength(fieldCompact)
    if (fieldLen === 0) {
      continue
    }

    for (const { compactToken: tokenCompact } of prepared) {
      const tokenLen = recallCodePointLength(tokenCompact)
      // 单字可命中，但贴合度加成仍要求 ≥2 码点，避免「的/了」类单字虚抬 Top Pick
      if (tokenLen < 2 || !fieldCompact.includes(tokenCompact)) {
        continue
      }

      const density = tokenLen / fieldLen
      let gain = Math.round(density * 20)
      if (fieldCompact.startsWith(tokenCompact)) {
        gain += 8
      }
      if (fieldCompact === tokenCompact || density >= 0.9) {
        gain += 10
      }
      gain += Math.min(6, tokenLen)

      best = Math.max(best, gain)
    }
  }

  return Math.min(PRIMARY_MATCH_QUALITY_CAP, best)
}

interface PreparedRecallToken extends RecallToken {
  /** 预计算 compact，供字段循环与模糊命中复用。 */
  compactToken: string
}

/**
 * 对单个 MemoryItem 用已拆好的 token 打分（列表 Filter 时只 tokenize 一次）。
 * 语义与 {@link scoreMemoryItem} 相同。
 * @param originalClue 原始线索（保留大小写；供 case-fit 软加权）
 */
function scoreMemoryItemWithTokens(
  item: MemoryItem,
  tokens: RecallToken[],
  options: RecallScoreOptions = {},
  originalClue = ''
): RecallMatch {
  const matchedFields = new Set<string>()
  let score = 0

  if (tokens.length === 0) {
    return { item, score: 0, matchedFields: [] }
  }

  const preparedTokens: PreparedRecallToken[] = tokens.map(entry => ({
    ...entry,
    compactToken: compactRecallText(entry.token)
  }))

  const behaviorProfile = options.behaviorProfile ?? 'default'
  const fields = collectFilterIndexFields(item).map(entry => ({
    field: entry.field,
    /** 规范化后用于忽略大小写命中 */
    text: normalizeRecallText(entry.text),
    compact: compactRecallText(entry.text),
    /** 原文：大小写贴合加权 */
    original: entry.text,
    weight: fieldWeight(entry.field, behaviorProfile)
  }))

  let exactScore = 0
  const fuzzyCandidates: PreparedRecallToken[] = []
  const ngramHitFields = new Set<string>()
  let primaryContentHit = false
  /** note 上命中的内容向 term 数（用于多锚点附注抬升）。 */
  let noteContentTermHits = 0
  /** 全字段命中的内容向 term 数（用于多锚点覆盖抬升）。 */
  let contentTermHits = 0
  let queryContentTermCount = 0

  for (const prepared of preparedTokens) {
    const { token, kind, compactToken } = prepared
    let tokenHit = false
    let hitNote = false
    const countsForCoverage =
      kind !== 'ngram' &&
      token.length >= CONTENT_COVERAGE_TERM_MIN_LEN &&
      /^[a-z0-9]+$/i.test(token)
    if (countsForCoverage) {
      queryContentTermCount += 1
    }

    for (const field of fields) {
      if (!exactTokenHit(field.text, field.compact, token, compactToken, field.original)) {
        continue
      }

      matchedFields.add(field.field)
      tokenHit = true
      if (field.field === 'note') {
        hitNote = true
      }
      if (kind === 'ngram') {
        ngramHitFields.add(field.field)
      } else if (PRIMARY_CONTENT_FIELDS.has(field.field)) {
        primaryContentHit = true
      }

      let gain = field.weight * scoreFactorForKind(kind)
      if (kind !== 'ngram' && token.length >= 4 && field.compact === compactToken) {
        gain += field.weight
      }
      // 更长 term 略加权，抑制纯 bigram 刷分
      if (kind === 'term' && token.length >= 4) {
        gain += Math.min(8, token.length)
      }

      exactScore += gain
    }

    if (
      hitNote &&
      kind !== 'ngram' &&
      token.length >= NOTE_COVERAGE_TERM_MIN_LEN &&
      /^[a-z0-9]+$/i.test(token)
    ) {
      noteContentTermHits += 1
    }

    if (tokenHit && countsForCoverage) {
      contentTermHits += 1
    }

    if (!tokenHit && kind !== 'ngram' && token.length >= 2 && token.length <= 8) {
      fuzzyCandidates.push(prepared)
    }
  }

  if (ngramHitFields.size > 0 && exactScore > 0) {
    exactScore += ngramHitFields.size * NGRAM_FIELD_BONUS
  }

  if (noteContentTermHits >= 2) {
    exactScore += (noteContentTermHits - 1) * NOTE_MULTI_TERM_HIT_BONUS
  }

  if (queryContentTermCount >= 2 && contentTermHits >= 2) {
    exactScore += (contentTermHits - 1) * CONTENT_MULTI_TERM_HIT_BONUS
    exactScore += Math.round(
      (contentTermHits / queryContentTermCount) * CONTENT_COVERAGE_RATIO_SCALE
    )
  }

  if (primaryContentHit) {
    exactScore += PRIMARY_CONTENT_HIT_BONUS
    const primaryCompacts = fields
      .filter(field => PRIMARY_CONTENT_FIELDS.has(field.field))
      .map(field => field.compact)
    exactScore += computePrimaryMatchQualityBoost(preparedTokens, primaryCompacts)
  }

  score = exactScore

  // 已有实体命中时，才允许错别字类模糊补分
  if (exactScore > 0) {
    for (const { compactToken } of fuzzyCandidates) {
      for (const field of fields) {
        if (!hasFuzzySubstring(field.compact, compactToken, 1)) {
          continue
        }
        matchedFields.add(field.field)
        score += field.weight * FUZZY_SCORE_FACTOR
      }
    }
  }

  if (score > 0) {
    const primaryOriginals = fields
      .filter(field => PRIMARY_CONTENT_FIELDS.has(field.field))
      .map(field => field.original)
    score += computeCaseFitBoost(originalClue, primaryOriginals)
    score += computeBehaviorBoost(item, options)
    score -= computeDismissPenalty(item)
    // 弱锚点（空壳书签等）降权：避免「只有 URL 回显标题」假装高置信可找回
    score -= weakAnchorScorePenalty(item)
    if (score < 0) {
      score = 0
    }
  }

  return {
    item,
    score,
    matchedFields: [...matchedFields]
  }
}

/**
 * 对单个 MemoryItem 计算关键词分数。
 * 先精确/ngram 命中；仅当已有精确分时，再补短 token 的编辑距离模糊，降低乱召回。
 * 词面分 > 0 时再叠加主文贴合度、大小写贴合与行为加权。
 */
export function scoreMemoryItem(
  item: MemoryItem,
  clue: string,
  options: RecallScoreOptions = {}
): RecallMatch {
  return scoreMemoryItemWithTokens(item, tokenizeRecallClueDetailed(clue), options, clue)
}

function hasPrimaryContentMatch(matchedFields: string[]): boolean {
  return matchedFields.some(field => PRIMARY_CONTENT_FIELDS.has(field))
}

/** 是否为主内容字段命中（title / 摘录正文 / 用户附注）。 */
export function hasRecallPrimaryContentMatch(matchedFields: readonly string[]): boolean {
  return hasPrimaryContentMatch([...matchedFields])
}

/** token 是否为泛词（host 线索不算泛词）。 */
function isGenericRecallToken(token: string, kind: TokenKind): boolean {
  if (kind === 'ngram') {
    return true
  }
  if (looksLikeRecallHostClue(token)) {
    return false
  }
  const normalized = normalizeRecallText(token)
  if (!normalized) {
    return true
  }
  if (normalized.includes(' ')) {
    const words = normalized.split(/\s+/).filter(part => isUsableRecallToken(part))
    return words.length > 0 && words.every(word => RECALL_GENERIC_CLUE_TERMS.has(word))
  }
  return RECALL_GENERIC_CLUE_TERMS.has(normalized)
}

/**
 * 线索是否「全泛词」：分词后无 host / 非泛词锚点。
 * 例：`movie review I saved` → true；`weekly review` → false（weekly 为锚点）。
 */
export function isGenericRecallClue(clue: string): boolean {
  const termTokens = tokenizeRecallClueDetailed(clue).filter(entry => entry.kind === 'term')
  if (termTokens.length > 0) {
    return termTokens.every(entry => isGenericRecallToken(entry.token, entry.kind))
  }

  const fallback = tokenizeRecallClueDetailed(clue).filter(entry => entry.kind !== 'ngram')
  if (fallback.length === 0) {
    return true
  }
  return fallback.every(entry => isGenericRecallToken(entry.token, entry.kind))
}

/**
 * 泛词 clue 且命中字段无主内容、仅 pageTitle 沾边 → 禁止 Top Pick。
 */
export function recallTopPickBlockedByGenericPageTitleGate(
  clue: string,
  matchedFields: readonly string[]
): boolean {
  if (!isGenericRecallClue(clue)) {
    return false
  }
  if (hasRecallPrimaryContentMatch(matchedFields)) {
    return false
  }
  return matchedFields.includes('pageTitle')
}

/**
 * clue 含非泛词锚点（如 atomic/bomb），但条目词面只沾到泛词（如 review）→ 真假阳性。
 * Hybrid 关键词池应丢弃，避免压过语义近邻（#4 Oppenheimer）。
 */
export function isGenericOnlyHitAgainstSpecificClue(clue: string, item: MemoryItem): boolean {
  const termTokens = tokenizeRecallClueDetailed(clue).filter(
    entry => entry.kind === 'term' || entry.kind === 'phrase'
  )
  const specificTokens = termTokens
    .map(entry => entry.token)
    .filter(token => !isGenericRecallToken(token, token.includes(' ') ? 'phrase' : 'term'))
  if (specificTokens.length === 0) {
    return false
  }

  const haystack = collectFilterIndexFields(item)
    .map(field => normalizeRecallText(field.text))
    .join('\n')
  const compactHay = compactRecallText(haystack)
  const hitSpecific = specificTokens.some(token => {
    const normalized = normalizeRecallText(token)
    if (!normalized) {
      return false
    }
    if (haystack.includes(normalized)) {
      return true
    }
    const compact = compactRecallText(token)
    return compact.length > 0 && compactHay.includes(compact)
  })
  return !hitSpecific
}

/** 对 MemoryItem 列表执行关键词 Filter 并排序。 */
export function filterMemoryItemsByKeyword(
  items: MemoryItem[],
  clue: string,
  options: {
    limit?: number
    minScore?: number
    nowMs?: number
    behaviorProfile?: RecallBehaviorProfile
  } = {}
): RecallMatch[] {
  const limit = options.limit ?? 6
  const minScore = options.minScore ?? RECALL_MIN_MATCH_SCORE
  const scoreOptions: RecallScoreOptions = {
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
    ...(options.behaviorProfile === undefined ? {} : { behaviorProfile: options.behaviorProfile })
  }
  // 整表只分词一次，避免 N 次重复 tokenize
  const tokens = tokenizeRecallClueDetailed(clue)

  return items
    .map(item => scoreMemoryItemWithTokens(item, tokens, scoreOptions, clue))
    .filter(match => match.score >= minScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      // 同分：主文命中优先于仅上下文
      const leftPrimary = hasPrimaryContentMatch(left.matchedFields) ? 1 : 0
      const rightPrimary = hasPrimaryContentMatch(right.matchedFields) ? 1 : 0
      if (rightPrimary !== leftPrimary) {
        return rightPrimary - leftPrimary
      }
      return right.item.updatedAt.localeCompare(left.item.updatedAt)
    })
    .slice(0, limit)
}
