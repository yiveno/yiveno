/**
 * Recall 结果层重复折叠（库内仍允许并存）。
 * 折叠键定义见 {@link getMemoryFoldKey}；Also 相对 Top 互斥规则在本模块。
 */

import {
  canonicalizeBookmarkDuplicateUrl,
  getMemoryFoldKey,
  normalizeDuplicateHostname,
  serializeMemoryFoldKey,
  type MemoryFoldKey
} from '@/core/memory/derive-memory-duplicate-key'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallDuplicateGroup, RecallMatch } from '@/core/recall/recall-result'

/** @deprecated 使用 MemoryFoldKey；保留 Recall 模块别名。 */
export type RecallDuplicateKey = MemoryFoldKey

export { canonicalizeBookmarkDuplicateUrl, normalizeDuplicateHostname }

/** 书签折叠互斥用域名（与 canonicalize 主机规则一致）。 */
export function getBookmarkDuplicateDomain(item: MemoryItem): string | null {
  if (item.type !== 'bookmark') {
    return null
  }
  const fromPayload = item.payload.domain.trim()
  if (fromPayload) {
    return normalizeDuplicateHostname(fromPayload)
  }
  try {
    return normalizeDuplicateHostname(new URL(item.payload.url.trim()).hostname)
  } catch {
    return null
  }
}

/** 取折叠键；无法建键时退化为 singleton。 */
export function getRecallDuplicateKey(item: MemoryItem): RecallDuplicateKey {
  return getMemoryFoldKey(item)
}

/** 折叠键稳定序列化（Map / Set 用）。 */
export function serializeRecallDuplicateKey(key: RecallDuplicateKey): string {
  return serializeMemoryFoldKey(key)
}

/**
 * Top 与 Also 是否冲突（互斥）。
 * - 同一折叠键（同规范化 URL / 同摘录正文）
 * - 双方均为书签且规范化域名相同（同站其它 path 不进 Also，也不并进 stacks N）
 */
export function recallMatchConflictsWithTopPick(top: RecallMatch, candidate: RecallMatch): boolean {
  const topKey = serializeRecallDuplicateKey(getRecallDuplicateKey(top.item))
  const candidateKey = serializeRecallDuplicateKey(getRecallDuplicateKey(candidate.item))
  if (topKey === candidateKey) {
    return true
  }

  const topDomain = getBookmarkDuplicateDomain(top.item)
  const candidateDomain = getBookmarkDuplicateDomain(candidate.item)
  return Boolean(topDomain && candidateDomain && topDomain === candidateDomain)
}

function hasNote(match: RecallMatch): boolean {
  return Boolean(match.item.clues.note?.trim())
}

function lastOpenedMs(match: RecallMatch): number {
  const raw = match.item.clues.lastOpenedAt
  if (!raw) {
    return 0
  }
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function openCountOf(match: RecallMatch): number {
  return match.item.clues.openCount ?? 0
}

function createdMs(match: RecallMatch): number {
  const parsed = Date.parse(match.item.createdAt)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * 组内代表选取（稳定）：
 * score → 有 note → lastOpenedAt → openCount → createdAt 最晚优先 → id
 * （完全重复时以创建时间唯一决胜，取最晚那条。）
 */
export function compareRecallDuplicateMembers(a: RecallMatch, b: RecallMatch): number {
  if (b.score !== a.score) {
    return b.score - a.score
  }
  const noteDiff = Number(hasNote(b)) - Number(hasNote(a))
  if (noteDiff !== 0) {
    return noteDiff
  }
  const openedDiff = lastOpenedMs(b) - lastOpenedMs(a)
  if (openedDiff !== 0) {
    return openedDiff
  }
  const openCountDiff = openCountOf(b) - openCountOf(a)
  if (openCountDiff !== 0) {
    return openCountDiff
  }
  const createdDiff = createdMs(b) - createdMs(a)
  if (createdDiff !== 0) {
    return createdDiff
  }
  return a.item.id.localeCompare(b.item.id)
}

/** 从组员中选出代表（不修改入参顺序语义；返回排序后首项）。 */
export function pickDuplicateRepresentative(members: RecallMatch[]): RecallMatch {
  if (members.length === 0) {
    throw new Error('pickDuplicateRepresentative: members 不能为空')
  }
  const sorted = [...members].sort(compareRecallDuplicateMembers)
  const first = sorted[0]
  if (!first) {
    throw new Error('pickDuplicateRepresentative: 排序结果为空')
  }
  return first
}

function stripDuplicateGroup(match: RecallMatch): RecallMatch {
  if (!match.duplicateGroup) {
    return match
  }
  return {
    item: match.item,
    score: match.score,
    matchedFields: match.matchedFields
  }
}

/**
 * 将有序命中列表按折叠键合并为互异组代表，并回填至 limit。
 * 输入应已按召回 score 大致有序；组首次出现顺序保留该序。
 */
export function collapseRecallMatches(
  matches: RecallMatch[],
  options: { limit?: number } = {}
): RecallMatch[] {
  const limit = options.limit ?? 6
  if (limit <= 0 || matches.length === 0) {
    return []
  }

  const groups = new Map<string, RecallMatch[]>()
  const keyOrder: string[] = []

  for (const match of matches) {
    const clean = stripDuplicateGroup(match)
    const key = serializeRecallDuplicateKey(getRecallDuplicateKey(clean.item))
    const existing = groups.get(key)
    if (existing) {
      existing.push(clean)
      continue
    }
    groups.set(key, [clean])
    keyOrder.push(key)
  }

  const collapsed: RecallMatch[] = []
  for (const key of keyOrder) {
    const members = groups.get(key)
    if (!members || members.length === 0) {
      continue
    }

    const sorted = [...members].sort(compareRecallDuplicateMembers)
    const representative = sorted[0]
    if (!representative) {
      continue
    }

    if (sorted.length < 2) {
      collapsed.push(representative)
    } else {
      const siblings = sorted.slice(1).map(stripDuplicateGroup)
      const duplicateGroup: RecallDuplicateGroup = {
        totalCount: sorted.length,
        siblings
      }
      collapsed.push({ ...representative, duplicateGroup })
    }

    if (collapsed.length >= limit) {
      break
    }
  }

  return collapsed
}
