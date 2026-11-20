/**
 * Dreaming 每日回顾 · 确定性纯函数（楔子 #1）。
 * 无 IDB / chrome / 网络 / LLM；分组、排序、关系句、推荐理由均由规则产出。
 */

import {
  hasMemoryNoteSourceCitation,
  type MemoryNoteRecord
} from '@/infrastructure/indexeddb/memory-notes-types'

/** 第一节最多渲染的命题行数。 */
export const DAILY_REVIEW_GROUP_NOTE_LIMIT = 20 as const

/** 值得再看 fallback：最近高频 topic 取前 N。 */
export const DAILY_REVIEW_RECENT_TOPIC_TOP_N = 5 as const

/** 关系句：同源或共享 topic（单成员组为 null）。 */
export type DailyReviewRelation =
  | { kind: 'same_source'; title: string | null }
  | { kind: 'shared_topic'; memberCount: number; term: string }

/** 值得再看的理由（三档模板）。 */
export type DailyReviewFeaturedReason =
  | { kind: 'shared_with_older'; term: string; olderHitCount: number }
  | { kind: 'recent_topic'; term: string }
  | { kind: 'latest_yesterday' }

/** 回顾里展示的一条命题。 */
export type DailyReviewNoteView = {
  id: string
  text: string
  /** 展示用引用；仅 span 无 quote 时为空串。 */
  sourceQuote: string
  sourceMemoryItemId: string
  /** 来源条目是否仍存在（缺则 UI 不渲染链接）。 */
  sourceExists: boolean
  sourceTitle: string
}

export type DailyReviewGroup = {
  relation: DailyReviewRelation | null
  notes: DailyReviewNoteView[]
}

export type DailyReviewFeatured = {
  note: DailyReviewNoteView
  reason: DailyReviewFeaturedReason
}

export type DailyReviewStale = {
  note: DailyReviewNoteView
  sourceMemoryItemId: string
  /** 首次标 stale 的 ISO；无则 null。 */
  firstStaleAt: string | null
}

export type BuildDailyReviewInput = {
  yesterdayNotes: MemoryNoteRecord[]
  olderNotes: MemoryNoteRecord[]
  recentNotes: MemoryNoteRecord[]
  /** 仅 linkStatus === 'stale'；绝不含 unknown。 */
  staleSourceIds: Set<string>
  staleFirstSeenAt: Map<string, string>
  /** 缺 key = 来源不存在；有 key 且空串 = 存在但无标题。 */
  sourceTitles: Map<string, string>
}

export type BuildDailyReviewResult = {
  groups: DailyReviewGroup[]
  featured: DailyReviewFeatured | null
  stale: DailyReviewStale | null
  skippedDirtyNotes: number
  /** 昨日命题总数（截断前提示用）。 */
  yesterdayNoteCount: number
  /** 是否因上限截断第一节命题行。 */
  groupsTruncated: boolean
}

/** 本地日历「昨日」窗口：[昨日 00:00, 今日 00:00)。 */
export function getLocalYesterdayWindow(nowMs: number = Date.now()): {
  startMs: number
  endMs: number
} {
  const now = new Date(nowMs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endMs = todayStart.getTime()
  const startMs = endMs - 24 * 60 * 60 * 1000
  return { startMs, endMs }
}

/** 本地日历「最近 N 天」窗口：[今日 00:00 − N 天, 今日 00:00 + 1 天) 含今日。 */
export function getLocalRecentDaysWindow(
  days: number,
  nowMs: number = Date.now()
): { startMs: number; endMs: number } {
  const now = new Date(nowMs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endMs = todayStart.getTime() + 24 * 60 * 60 * 1000
  const startMs = todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000
  return { startMs, endMs }
}

function isCreatedInWindow(createdAt: string, startMs: number, endMs: number): boolean {
  const ms = Date.parse(createdAt)
  if (!Number.isFinite(ms)) {
    return false
  }
  return ms >= startMs && ms < endMs
}

/** 按本地昨日窗口过滤命题（service 亦可内联；导出供单测/调用方复用）。 */
export function partitionNotesByLocalDay(
  notes: readonly MemoryNoteRecord[],
  nowMs: number = Date.now()
): {
  yesterdayNotes: MemoryNoteRecord[]
  olderNotes: MemoryNoteRecord[]
  recentNotes: MemoryNoteRecord[]
} {
  const yesterday = getLocalYesterdayWindow(nowMs)
  const recent = getLocalRecentDaysWindow(7, nowMs)
  const yesterdayNotes: MemoryNoteRecord[] = []
  const olderNotes: MemoryNoteRecord[] = []
  const recentNotes: MemoryNoteRecord[] = []
  for (const note of notes) {
    const ms = Date.parse(note.createdAt)
    if (!Number.isFinite(ms)) {
      continue
    }
    if (isCreatedInWindow(note.createdAt, yesterday.startMs, yesterday.endMs)) {
      yesterdayNotes.push(note)
    } else if (ms < yesterday.startMs) {
      olderNotes.push(note)
    }
    if (isCreatedInWindow(note.createdAt, recent.startMs, recent.endMs)) {
      recentNotes.push(note)
    }
  }
  return { yesterdayNotes, olderNotes, recentNotes }
}

function toNoteView(
  note: MemoryNoteRecord,
  sourceTitles: Map<string, string>
): DailyReviewNoteView {
  const sourceExists = sourceTitles.has(note.sourceMemoryItemId)
  return {
    id: note.id,
    text: note.text,
    sourceQuote: note.sourceQuote.trim(),
    sourceMemoryItemId: note.sourceMemoryItemId,
    sourceExists,
    sourceTitle: sourceExists ? (sourceTitles.get(note.sourceMemoryItemId) ?? '') : ''
  }
}

function noteSharesWithGroup(note: MemoryNoteRecord, groupNotes: MemoryNoteRecord[]): boolean {
  const topics = new Set(note.topicAnchor)
  for (const member of groupNotes) {
    if (member.sourceMemoryItemId === note.sourceMemoryItemId) {
      return true
    }
    for (const term of member.topicAnchor) {
      if (topics.has(term)) {
        return true
      }
    }
  }
  return false
}

function buildRelation(
  groupNotes: MemoryNoteRecord[],
  sourceTitles: Map<string, string>
): DailyReviewRelation | null {
  if (groupNotes.length <= 1) {
    return null
  }

  const sourceIds = new Set(groupNotes.map(n => n.sourceMemoryItemId))
  if (sourceIds.size === 1) {
    const sourceId = groupNotes[0]!.sourceMemoryItemId
    const title = sourceTitles.has(sourceId) ? (sourceTitles.get(sourceId) ?? '') : null
    const trimmed = title?.trim() ?? ''
    return { kind: 'same_source', title: trimmed.length > 0 ? trimmed : null }
  }

  // 被最多成员共享的 topic；并列取最早成员的 topicAnchor 首个
  const termMemberCounts = new Map<string, number>()
  for (const note of groupNotes) {
    const seen = new Set<string>()
    for (const term of note.topicAnchor) {
      if (seen.has(term)) {
        continue
      }
      seen.add(term)
      termMemberCounts.set(term, (termMemberCounts.get(term) ?? 0) + 1)
    }
  }

  let bestTerm: string | null = null
  let bestCount = 0
  for (const [term, count] of termMemberCounts) {
    if (count > bestCount) {
      bestCount = count
      bestTerm = term
    }
  }

  if (bestTerm == null || bestCount < 2) {
    // 无共享 topic 却成组 → 必是同源；上面已处理。兜底用最早成员首 topic
    const earliest = groupNotes[0]!
    const fallback = earliest.topicAnchor[0]
    if (fallback) {
      return { kind: 'shared_topic', memberCount: groupNotes.length, term: fallback }
    }
    return null
  }

  // 并列：取最早成员 topicAnchor 中、仍处并列最高分的词
  const tied = new Set(
    [...termMemberCounts.entries()].filter(([, c]) => c === bestCount).map(([t]) => t)
  )
  for (const note of groupNotes) {
    for (const term of note.topicAnchor) {
      if (tied.has(term)) {
        return { kind: 'shared_topic', memberCount: groupNotes.length, term }
      }
    }
  }

  return { kind: 'shared_topic', memberCount: groupNotes.length, term: bestTerm }
}

function scoreYesterdayAgainstOlder(
  note: MemoryNoteRecord,
  olderNotes: readonly MemoryNoteRecord[]
): { score: number; termHits: Map<string, number> } {
  const termHits = new Map<string, number>()
  const noteTerms = new Set(note.topicAnchor)
  if (noteTerms.size === 0) {
    return { score: 0, termHits }
  }
  for (const older of olderNotes) {
    const hitTerms = new Set<string>()
    for (const term of older.topicAnchor) {
      if (noteTerms.has(term)) {
        hitTerms.add(term)
      }
    }
    for (const term of hitTerms) {
      termHits.set(term, (termHits.get(term) ?? 0) + 1)
    }
  }
  return { score: termHits.size, termHits }
}

function pickFeatured(
  yesterdayClean: MemoryNoteRecord[],
  olderNotes: readonly MemoryNoteRecord[],
  recentNotes: readonly MemoryNoteRecord[],
  sourceTitles: Map<string, string>
): DailyReviewFeatured | null {
  if (yesterdayClean.length === 0) {
    return null
  }

  type Scored = {
    note: MemoryNoteRecord
    score: number
    termHits: Map<string, number>
  }
  const scored: Scored[] = yesterdayClean.map(note => {
    const { score, termHits } = scoreYesterdayAgainstOlder(note, olderNotes)
    return { note, score, termHits }
  })

  let bestScore = -1
  for (const row of scored) {
    if (row.score > bestScore) {
      bestScore = row.score
    }
  }

  if (bestScore > 0) {
    const tied = scored.filter(row => row.score === bestScore)
    tied.sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt))
    const winner = tied[0]!
    let bestTerm = ''
    let bestHit = -1
    for (const [term, hits] of winner.termHits) {
      if (hits > bestHit || (hits === bestHit && (bestTerm === '' || term < bestTerm))) {
        bestHit = hits
        bestTerm = term
      }
    }
    return {
      note: toNoteView(winner.note, sourceTitles),
      reason: { kind: 'shared_with_older', term: bestTerm, olderHitCount: bestHit }
    }
  }

  // fallback：最近 7 天最高频 5 个 topic
  const recentCounts = new Map<string, number>()
  for (const note of recentNotes) {
    const seen = new Set<string>()
    for (const term of note.topicAnchor) {
      if (seen.has(term)) {
        continue
      }
      seen.add(term)
      recentCounts.set(term, (recentCounts.get(term) ?? 0) + 1)
    }
  }
  const topTerms = [...recentCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1]
      }
      return a[0].localeCompare(b[0])
    })
    .slice(0, DAILY_REVIEW_RECENT_TOPIC_TOP_N)
    .map(([term]) => term)
  const topSet = new Set(topTerms)

  if (topSet.size > 0) {
    type FallbackScored = { note: MemoryNoteRecord; overlap: number; bestTerm: string }
    const fallbackScored: FallbackScored[] = yesterdayClean.map(note => {
      const hitTerms = note.topicAnchor.filter(t => topSet.has(t))
      const unique = [...new Set(hitTerms)]
      // 理由句取重叠中「最近常看」里出现最多的那个
      let bestTerm = ''
      let bestRecent = -1
      for (const term of unique) {
        const c = recentCounts.get(term) ?? 0
        if (c > bestRecent || (c === bestRecent && (bestTerm === '' || term < bestTerm))) {
          bestRecent = c
          bestTerm = term
        }
      }
      return { note, overlap: unique.length, bestTerm }
    })
    let maxOverlap = 0
    for (const row of fallbackScored) {
      if (row.overlap > maxOverlap) {
        maxOverlap = row.overlap
      }
    }
    if (maxOverlap > 0) {
      const tied = fallbackScored.filter(row => row.overlap === maxOverlap)
      tied.sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt))
      const winner = tied[0]!
      return {
        note: toNoteView(winner.note, sourceTitles),
        reason: { kind: 'recent_topic', term: winner.bestTerm }
      }
    }
  }

  // 全 0 兜底：昨日 createdAt 最晚
  const latest = [...yesterdayClean].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!
  return {
    note: toNoteView(latest, sourceTitles),
    reason: { kind: 'latest_yesterday' }
  }
}

function pickStale(
  allNotes: readonly MemoryNoteRecord[],
  staleSourceIds: Set<string>,
  staleFirstSeenAt: Map<string, string>,
  sourceTitles: Map<string, string>
): DailyReviewStale | null {
  if (staleSourceIds.size === 0) {
    return null
  }

  // 只考虑有命题挂靠的 stale 来源
  const notesBySource = new Map<string, MemoryNoteRecord[]>()
  for (const note of allNotes) {
    if (!staleSourceIds.has(note.sourceMemoryItemId)) {
      continue
    }
    const list = notesBySource.get(note.sourceMemoryItemId) ?? []
    list.push(note)
    notesBySource.set(note.sourceMemoryItemId, list)
  }
  if (notesBySource.size === 0) {
    return null
  }

  type Candidate = {
    sourceId: string
    firstStaleAt: string | null
    representative: MemoryNoteRecord
  }
  const candidates: Candidate[] = []
  for (const [sourceId, notes] of notesBySource) {
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const representative = sorted[0]!
    const firstStaleAt = staleFirstSeenAt.get(sourceId) ?? null
    candidates.push({ sourceId, firstStaleAt, representative })
  }

  // 取 firstStaleAt 最早；无 firstStaleAt 的排在有值之后（仍可选），同缺省时按代表命题 createdAt 最晚
  candidates.sort((a, b) => {
    if (a.firstStaleAt != null && b.firstStaleAt != null) {
      const cmp = a.firstStaleAt.localeCompare(b.firstStaleAt)
      if (cmp !== 0) {
        return cmp
      }
    } else if (a.firstStaleAt != null) {
      return -1
    } else if (b.firstStaleAt != null) {
      return 1
    }
    return b.representative.createdAt.localeCompare(a.representative.createdAt)
  })

  const winner = candidates[0]!
  return {
    note: toNoteView(winner.representative, sourceTitles),
    sourceMemoryItemId: winner.sourceId,
    firstStaleAt: winner.firstStaleAt
  }
}

/**
 * 组装每日回顾 DTO（确定性）。
 * 脏行（引用双无）只计数不渲染。
 */
export function buildDailyReview(input: BuildDailyReviewInput): BuildDailyReviewResult {
  let skippedDirtyNotes = 0

  const cleanYesterday: MemoryNoteRecord[] = []
  for (const note of input.yesterdayNotes) {
    if (
      !hasMemoryNoteSourceCitation({
        sourceQuote: note.sourceQuote,
        ...(note.sourceSpan != null ? { sourceSpan: note.sourceSpan } : {})
      })
    ) {
      skippedDirtyNotes += 1
      continue
    }
    cleanYesterday.push(note)
  }

  // 分组：昨日命题按 createdAt 升序贪心
  const ordered = [...cleanYesterday].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const groupMembers: MemoryNoteRecord[][] = []
  for (const note of ordered) {
    let joined = false
    for (const members of groupMembers) {
      if (noteSharesWithGroup(note, members)) {
        members.push(note)
        joined = true
        break
      }
    }
    if (!joined) {
      groupMembers.push([note])
    }
  }

  const allGroupNotes = groupMembers.flatMap(members =>
    members.map(note => toNoteView(note, input.sourceTitles))
  )
  const groupsTruncated = allGroupNotes.length > DAILY_REVIEW_GROUP_NOTE_LIMIT

  // 截断按组顺序保留前 20 条命题行
  let remaining = DAILY_REVIEW_GROUP_NOTE_LIMIT
  const groups: DailyReviewGroup[] = []
  for (const members of groupMembers) {
    if (remaining <= 0) {
      break
    }
    const views = members.map(note => toNoteView(note, input.sourceTitles))
    const sliced = views.slice(0, remaining)
    remaining -= sliced.length
    groups.push({
      relation: buildRelation(members, input.sourceTitles),
      notes: sliced
    })
  }

  const featured = pickFeatured(
    cleanYesterday,
    input.olderNotes,
    input.recentNotes,
    input.sourceTitles
  )

  // 过时节：在全部已加载命题（昨日+更早+最近，去重）中找
  const allLoaded = new Map<string, MemoryNoteRecord>()
  for (const note of [...input.yesterdayNotes, ...input.olderNotes, ...input.recentNotes]) {
    allLoaded.set(note.id, note)
  }
  const stale = pickStale(
    [...allLoaded.values()],
    input.staleSourceIds,
    input.staleFirstSeenAt,
    input.sourceTitles
  )

  return {
    groups,
    featured,
    stale,
    skippedDirtyNotes,
    yesterdayNoteCount: cleanYesterday.length,
    groupsTruncated
  }
}
