import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'

/** 纳入候选的最低分数。 */
export const RECALL_MIN_MATCH_SCORE = 10

/** Top Pick 最低分数。 */
export const RECALL_TOP_PICK_MIN_SCORE = 18

const FIELD_WEIGHTS: Record<string, number> = {
  title: 24,
  textExcerpt: 18,
  /** 划词前后文：可召回但不得与正文同权，避免「上下文沾边」压过主文直含。 */
  excerptContext: 8,
  /** 摘录出处页名（非摘录自身标题）；须单字段即可达 Top Pick 阈值。 */
  pageTitle: 20,
  summary: 16,
  domain: 14,
  url: 10,
  keywords: 12,
  tags: 12,
  /** 用户自拟备注：寻回意图强信号，权重大于标题。 */
  note: 26
}

/** 中文/无空格脚本 ngram 命中相对字段权重的系数。 */
const NGRAM_SCORE_FACTOR = 0.5

/** 模糊命中（编辑距离 ≤1）相对字段权重的系数。 */
const FUZZY_SCORE_FACTOR = 0.6

/** 仅 bigram 命中时，按命中字段数给的抬升，避免「检查」类有效词过不了 Top Pick。 */
const NGRAM_FIELD_BONUS = 4

/**
 * 标题/摘录正文出现非 ngram 命中时的额外分。
 * 保证「主文含词」稳定压过「仅上下文沾边」（含行为加权后仍优先）。
 */
const PRIMARY_CONTENT_HIT_BONUS = 16

/** 主文贴合度加成上限（密度 / 起首 / 近全等，语言无关）。 */
const PRIMARY_MATCH_QUALITY_CAP = 30

/** 行为信号（打开次数/近因）对关键词分的最大加成，避免压过强词面命中。 */
export const RECALL_BEHAVIOR_BOOST_CAP = 12

/** 否定反馈（dismiss）对分数的最大扣减。 */
export const RECALL_DISMISS_PENALTY_CAP = 10

const DAY_MS = 24 * 60 * 60 * 1000

const PRIMARY_CONTENT_FIELDS = new Set(['title', 'textExcerpt', 'note'])

interface SearchableField {
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

/** 打分可选时钟（eval 固定 now，避免近因漂移）。 */
export interface RecallScoreOptions {
  nowMs?: number
}

/** 归一化筛选文本。 */
export function normalizeRecallText(text: string): string {
  return text.trim().toLowerCase()
}

/** 去掉空白，便于「Yiveno产品」对上「Yiveno 产品」。 */
export function compactRecallText(text: string): string {
  return normalizeRecallText(text).replace(/\s+/g, '')
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
    }
  }

  for (const match of compactClue.match(/[^\s\x00-\x7f]{1,24}/g) ?? []) {
    pushUnspacedScriptTokens(match, byToken)
  }

  return [...byToken.entries()].map(([token, kind]) => ({ token, kind }))
}

/** 将线索拆分为 token 字符串（兼容解释层与既有测试）。 */
export function tokenizeRecallClue(clue: string): string[] {
  return tokenizeRecallClueDetailed(clue).map(entry => entry.token)
}

/** 收集 MemoryItem 的可匹配字段（关键词 Filter）；按 field+紧凑文本去重。 */
export function collectSearchableFields(item: MemoryItem): SearchableField[] {
  const fields: SearchableField[] = []
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
    push('title', clues.title)
    push('title', item.payload.title)
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

function fieldWeight(field: string): number {
  return FIELD_WEIGHTS[field] ?? 8
}

function exactTokenHit(fieldText: string, compactField: string, token: string): boolean {
  if (fieldText.includes(token) || compactField.includes(token)) {
    return true
  }
  const compactToken = compactRecallText(token)
  return compactToken.length >= 2 && compactField.includes(compactToken)
}

function scoreFactorForKind(kind: TokenKind): number {
  if (kind === 'ngram') {
    return NGRAM_SCORE_FACTOR
  }
  return 1
}

/**
 * 行为加权：仅在已有词面命中时使用。
 * openCount 用 log2 压缩；近 7/30 天打开给近因分；总和封顶。
 */
export function computeBehaviorBoost(item: MemoryItem, options: RecallScoreOptions = {}): number {
  const openCount = item.clues.openCount
  const openBoost = openCount > 0 ? Math.min(8, Math.floor(Math.log2(openCount + 1) * 3)) : 0

  let recencyBoost = 0
  const lastOpenedAt = item.clues.lastOpenedAt
  if (lastOpenedAt) {
    const openedMs = Date.parse(lastOpenedAt)
    if (!Number.isNaN(openedMs)) {
      const ageMs = (options.nowMs ?? Date.now()) - openedMs
      if (ageMs >= 0 && ageMs <= 7 * DAY_MS) {
        recencyBoost = 4
      } else if (ageMs >= 0 && ageMs <= 30 * DAY_MS) {
        recencyBoost = 2
      }
    }
  }

  return Math.min(RECALL_BEHAVIOR_BOOST_CAP, openBoost + recencyBoost)
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
  tokens: Array<{ token: string; kind: TokenKind }>,
  primaryCompacts: string[]
): number {
  if (primaryCompacts.length === 0) {
    return 0
  }

  let best = 0

  for (const fieldCompact of primaryCompacts) {
    const fieldLen = recallCodePointLength(fieldCompact)
    if (fieldLen === 0) {
      continue
    }

    for (const { token, kind } of tokens) {
      if (kind === 'ngram') {
        continue
      }
      const tokenCompact = compactRecallText(token)
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

/**
 * 对单个 MemoryItem 计算关键词分数。
 * 先精确/ngram 命中；仅当已有精确分时，再补短 token 的编辑距离模糊，降低乱召回。
 * 词面分 > 0 时再叠加主文贴合度与行为加权。
 */
export function scoreMemoryItem(
  item: MemoryItem,
  clue: string,
  options: RecallScoreOptions = {}
): RecallMatch {
  const tokens = tokenizeRecallClueDetailed(clue)
  const matchedFields = new Set<string>()
  let score = 0

  if (tokens.length === 0) {
    return { item, score: 0, matchedFields: [] }
  }

  const fields = collectSearchableFields(item).map(entry => ({
    field: entry.field,
    text: normalizeRecallText(entry.text),
    compact: compactRecallText(entry.text),
    weight: fieldWeight(entry.field)
  }))

  let exactScore = 0
  const fuzzyCandidates: RecallToken[] = []
  const ngramHitFields = new Set<string>()
  let primaryContentHit = false

  for (const { token, kind } of tokens) {
    let tokenHit = false

    for (const field of fields) {
      if (!exactTokenHit(field.text, field.compact, token)) {
        continue
      }

      matchedFields.add(field.field)
      tokenHit = true
      if (kind === 'ngram') {
        ngramHitFields.add(field.field)
      } else if (PRIMARY_CONTENT_FIELDS.has(field.field)) {
        primaryContentHit = true
      }

      let gain = field.weight * scoreFactorForKind(kind)
      if (kind !== 'ngram' && token.length >= 4 && field.compact === compactRecallText(token)) {
        gain += field.weight
      }
      // 更长 term 略加权，抑制纯 bigram 刷分
      if (kind === 'term' && token.length >= 4) {
        gain += Math.min(8, token.length)
      }

      exactScore += gain
    }

    if (!tokenHit && kind !== 'ngram' && token.length >= 2 && token.length <= 8) {
      fuzzyCandidates.push({ token, kind })
    }
  }

  if (ngramHitFields.size > 0 && exactScore > 0) {
    exactScore += ngramHitFields.size * NGRAM_FIELD_BONUS
  }

  if (primaryContentHit) {
    exactScore += PRIMARY_CONTENT_HIT_BONUS
    const primaryCompacts = fields
      .filter(field => PRIMARY_CONTENT_FIELDS.has(field.field))
      .map(field => field.compact)
    exactScore += computePrimaryMatchQualityBoost(tokens, primaryCompacts)
  }

  score = exactScore

  // 已有实体命中时，才允许错别字类模糊补分
  if (exactScore > 0) {
    for (const { token } of fuzzyCandidates) {
      for (const field of fields) {
        if (!hasFuzzySubstring(field.compact, compactRecallText(token), 1)) {
          continue
        }
        matchedFields.add(field.field)
        score += field.weight * FUZZY_SCORE_FACTOR
      }
    }
  }

  if (score > 0) {
    score += computeBehaviorBoost(item, options)
    score -= computeDismissPenalty(item)
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

function hasPrimaryContentMatch(matchedFields: string[]): boolean {
  return matchedFields.includes('title') || matchedFields.includes('textExcerpt')
}

/** 对 MemoryItem 列表执行关键词 Filter 并排序。 */
export function filterMemoryItemsByKeyword(
  items: MemoryItem[],
  clue: string,
  options: { limit?: number; minScore?: number; nowMs?: number } = {}
): RecallMatch[] {
  const limit = options.limit ?? 6
  const minScore = options.minScore ?? RECALL_MIN_MATCH_SCORE
  const scoreOptions: RecallScoreOptions = {
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs })
  }

  return items
    .map(item => scoreMemoryItem(item, clue, scoreOptions))
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
