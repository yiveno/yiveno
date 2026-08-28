/**
 * 从 MemoryItem 提取倒排文档 token（查询 token 的超集）。
 * 供关键词倒排预过滤；精排仍走 keyword-filter 子串打分。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  collectFilterIndexFields,
  compactRecallText,
  extractOrthographicAcronyms,
  isUsableRecallToken,
  latinInflectionVariants,
  normalizeRecallText,
  tokenizeRecallClueDetailed
} from '@/core/recall/keyword-filter'

/** 单条文档写入 posting 的 token 上限（防长摘录爆表）。 */
export const DOCUMENT_INDEX_TOKEN_CAP = 400

/** 对连续无空格脚本做 1/2-gram 时扫描的最大字符数。 */
const CJK_NGRAM_CHAR_CAP = 120

/**
 * 从一段文本写入倒排用 token。
 * - 拉丁词（小写）
 * - 原文形态缩写（JavaScript→js；React Native→rn）
 * - 紧凑串上的汉字等 1-gram / 2-gram（截断）
 * - 与查询侧一致的 tokenizeRecallClueDetailed
 */
export function addDocumentIndexTokensFromText(text: string, sink: Set<string>): void {
  const normalized = normalizeRecallText(text)
  if (!normalized) {
    return
  }

  for (const match of normalized.match(/[a-z0-9]+(?:'[a-z0-9]+)*/gi) ?? []) {
    const token = match.toLowerCase()
    if (isUsableRecallToken(token)) {
      sink.add(token)
      for (const variant of latinInflectionVariants(token)) {
        sink.add(variant)
      }
    }
  }

  // 形态缩写：必须用原文（保留大小写），不能只靠小写整词
  for (const acronym of extractOrthographicAcronyms(text)) {
    sink.add(acronym)
  }

  const compact = compactRecallText(text)
  const chars = Array.from(compact).slice(0, CJK_NGRAM_CHAR_CAP)
  for (const ch of chars) {
    if (isUsableRecallToken(ch)) {
      sink.add(ch)
    }
  }
  for (let index = 0; index + 1 < chars.length; index += 1) {
    sink.add(`${chars[index]}${chars[index + 1]}`)
  }

  for (const entry of tokenizeRecallClueDetailed(text)) {
    if (isUsableRecallToken(entry.token)) {
      sink.add(entry.token)
    }
  }
}

/** 可检索字段 → 去重 token 列表（有上限）。 */
export function extractDocumentIndexTokens(item: MemoryItem): string[] {
  if (item.deletedAt != null) {
    return []
  }

  const sink = new Set<string>()
  for (const field of collectFilterIndexFields(item)) {
    addDocumentIndexTokensFromText(field.text, sink)
    if (sink.size >= DOCUMENT_INDEX_TOKEN_CAP) {
      break
    }
  }

  if (sink.size <= DOCUMENT_INDEX_TOKEN_CAP) {
    return [...sink]
  }
  return [...sink].slice(0, DOCUMENT_INDEX_TOKEN_CAP)
}

/** 查询侧：用于查 posting 的 token（与精排同一分词入口；形态缩写已在建索引时写入）。 */
export function pickPostingLookupTokens(clue: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  const push = (token: string): void => {
    if (!isUsableRecallToken(token) || seen.has(token)) {
      return
    }
    seen.add(token)
    tokens.push(token)
  }
  for (const entry of tokenizeRecallClueDetailed(clue)) {
    push(entry.token)
    for (const variant of latinInflectionVariants(entry.token)) {
      push(variant)
    }
  }
  return tokens
}

/** 多个 posting 列表做 OR 并集（保序：先出现的 token 优先）。 */
export function unionPostingItemIds(lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id)) {
        continue
      }
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/**
 * 倒排候选在 cap 内选取：按「命中 token 稀有度」加权，避免常见字/词先塞满而挤掉稀有命中。
 * 分值 = Σ(1 / postingLen)；同分按 id 字典序稳定截断。
 * 未超 cap 时返回全量并集（顺序不保证与 unionPostingItemIds 一致）。
 */
export function selectPostingCandidateIds(
  lists: readonly (readonly string[])[],
  cap: number
): string[] {
  if (cap <= 0) {
    return []
  }

  const scores = new Map<string, number>()
  for (const list of lists) {
    if (list.length === 0) {
      continue
    }
    const rarity = 1 / list.length
    for (const id of list) {
      scores.set(id, (scores.get(id) ?? 0) + rarity)
    }
  }

  if (scores.size === 0) {
    return []
  }
  if (scores.size <= cap) {
    return [...scores.keys()]
  }

  return [...scores.entries()]
    .sort((left, right) => {
      const scoreDelta = right[1] - left[1]
      if (scoreDelta !== 0) {
        return scoreDelta
      }
      return left[0].localeCompare(right[0])
    })
    .slice(0, cap)
    .map(([id]) => id)
}

/** 比较两组 token 是否相同（忽略顺序）。 */
export function sameTokenSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const rightSet = new Set(right)
  return left.every(token => rightSet.has(token))
}

/** 计算 token 增删（用于倒排增量维护）。 */
export function diffTokenSets(
  previous: readonly string[],
  next: readonly string[]
): { added: string[]; removed: string[] } {
  const prevSet = new Set(previous)
  const nextSet = new Set(next)
  const added: string[] = []
  const removed: string[] = []
  for (const token of nextSet) {
    if (!prevSet.has(token)) {
      added.push(token)
    }
  }
  for (const token of prevSet) {
    if (!nextSet.has(token)) {
      removed.push(token)
    }
  }
  return { added, removed }
}
