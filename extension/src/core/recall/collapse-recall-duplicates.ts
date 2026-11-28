/**
 * Recall 结果层重复折叠（库内仍允许并存）。
 * 折叠键定义见 {@link getMemoryFoldKey}；Also 相对 Top 互斥规则在本模块。
 */

import {
  getMemoryFoldKey,
  serializeMemoryFoldKey,
  type MemoryFoldKey
} from '@/core/memory/derive-memory-duplicate-key'
import { itemCorroboratesContentTerms } from '@/core/recall/content-term-corroboration'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { NoteProvenance, RecallDuplicateGroup, RecallMatch } from '@/core/recall/recall-result'

/** @deprecated 使用 MemoryFoldKey；保留 Recall 模块别名。 */
export type RecallDuplicateKey = MemoryFoldKey

/** 兼容再导出：书签 URL 规范化仍落在 derive-memory-duplicate-key。 */
export { canonicalizeBookmarkDuplicateUrl } from '@/core/memory/derive-memory-duplicate-key'

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
 * 仅同一折叠键（同规范化 URL / 同摘录正文）互斥；同域名不同 path 可同进邻域。
 */
export function recallMatchConflictsWithTopPick(top: RecallMatch, candidate: RecallMatch): boolean {
  const topKey = serializeRecallDuplicateKey(getRecallDuplicateKey(top.item))
  const candidateKey = serializeRecallDuplicateKey(getRecallDuplicateKey(candidate.item))
  return topKey === candidateKey
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

/**
 * 组级继承（设计稿 §3.2）：代表项继承组内最优命题出处。
 * 最优 = 字面优先于语义；同种内匹配词数/相似度最多；并列取 propositionIndex 最小。
 * soleCorroboration 按代表项重算（同一判定函数）；无 terms 可算时沿用继承出处的标记。
 */
function isBetterProvenance(next: NoteProvenance, best: NoteProvenance): boolean {
  const nextKind = next.matchKind ?? 'literal'
  const bestKind = best.matchKind ?? 'literal'
  if (nextKind !== bestKind) {
    return nextKind === 'literal'
  }
  if (nextKind === 'literal') {
    if (next.matchedTerms.length !== best.matchedTerms.length) {
      return next.matchedTerms.length > best.matchedTerms.length
    }
    return next.propositionIndex < best.propositionIndex
  }
  const nextScore = next.semanticScore ?? 0
  const bestScore = best.semanticScore ?? 0
  if (nextScore !== bestScore) {
    return nextScore > bestScore
  }
  return next.propositionIndex < best.propositionIndex
}

function inheritBestNoteProvenance(
  members: RecallMatch[],
  representative: RecallMatch,
  noteMatchTerms?: readonly string[]
): RecallMatch {
  let best: NoteProvenance | null = null
  for (const member of members) {
    const provenance = member.noteProvenance
    if (!provenance) {
      continue
    }
    if (!best || isBetterProvenance(provenance, best)) {
      best = provenance
    }
  }
  if (!best) {
    return representative
  }
  const soleCorroboration =
    noteMatchTerms && noteMatchTerms.length > 0
      ? !itemCorroboratesContentTerms(representative.item, noteMatchTerms)
      : best.soleCorroboration
  return { ...representative, noteProvenance: { ...best, soleCorroboration } }
}

/** 从组员中选出代表（不修改入参顺序语义；返回排序后首项）。 */
export function pickDuplicateRepresentative(
  members: RecallMatch[],
  noteMatchTerms?: readonly string[]
): RecallMatch {
  if (members.length === 0) {
    throw new Error('pickDuplicateRepresentative: members 不能为空')
  }
  const sorted = [...members].sort(compareRecallDuplicateMembers)
  const first = sorted[0]
  if (!first) {
    throw new Error('pickDuplicateRepresentative: 排序结果为空')
  }
  return inheritBestNoteProvenance(sorted, first, noteMatchTerms)
}

function stripDuplicateGroup(match: RecallMatch): RecallMatch {
  if (!match.duplicateGroup) {
    return match
  }
  return {
    item: match.item,
    score: match.score,
    matchedFields: match.matchedFields,
    ...(match.noteProvenance ? { noteProvenance: match.noteProvenance } : {})
  }
}

/**
 * 将有序命中列表按折叠键合并为互异组代表，并回填至 limit。
 * 输入应已按召回 score 大致有序；组首次出现顺序保留该序。
 */
export function collapseRecallMatches(
  matches: RecallMatch[],
  options: { limit?: number; noteMatchTerms?: readonly string[] } = {}
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
    // 代表选取经 pickDuplicateRepresentative（含组级命题出处继承）；members 非空时不抛错。
    const representative = pickDuplicateRepresentative(sorted, options.noteMatchTerms)

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
