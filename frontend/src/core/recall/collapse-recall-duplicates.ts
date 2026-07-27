/**
 * Recall 结果层重复折叠（库内仍允许并存）。
 * 书签键 = 规范化完整 URL；摘录键 = trim 后正文；跨类型不互折。
 * Also 相对 Top：同键或同规范化域名互斥（避免只显示域名时看起来重复）。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallDuplicateGroup, RecallMatch } from '@/core/recall/recall-result'

/** 折叠键（序列化前）。 */
export type RecallDuplicateKey =
  | { kind: 'bookmark'; url: string }
  | { kind: 'excerpt'; text: string }
  | { kind: 'singleton'; id: string }

/** 主机名规范化：小写，去掉前导 www。 */
export function normalizeDuplicateHostname(hostname: string): string {
  const lower = hostname.trim().toLowerCase()
  return lower.startsWith('www.') ? lower.slice(4) : lower
}

/**
 * 书签折叠用 URL 规范化（展示 URL 仍用原值）。
 * - host 小写、去 www
 * - 去掉默认端口
 * - 非根 path 去尾部 /
 * - 保留 protocol / query / hash
 */
export function canonicalizeBookmarkDuplicateUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    parsed.username = ''
    parsed.password = ''
    parsed.hostname = normalizeDuplicateHostname(parsed.hostname)
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = ''
    }
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    }
    return parsed.href
  } catch {
    return url.trim()
  }
}

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
  if (item.type === 'bookmark') {
    const url = item.payload.url.trim()
    if (!url) {
      return { kind: 'singleton', id: item.id }
    }
    return { kind: 'bookmark', url: canonicalizeBookmarkDuplicateUrl(url) }
  }

  if (item.type === 'text_excerpt') {
    const text = item.payload.selectedText.trim()
    if (!text) {
      return { kind: 'singleton', id: item.id }
    }
    return { kind: 'excerpt', text }
  }

  return { kind: 'singleton', id: item.id }
}

/** 折叠键稳定序列化（Map / Set 用）。 */
export function serializeRecallDuplicateKey(key: RecallDuplicateKey): string {
  switch (key.kind) {
    case 'bookmark':
      return `b:${key.url}`
    case 'excerpt':
      return `e:${key.text}`
    case 'singleton':
      return `id:${key.id}`
  }
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
