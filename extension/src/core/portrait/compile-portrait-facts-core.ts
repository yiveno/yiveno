/**
 * 画像夜间编译纯函数：行为 top3 / 命题推断 / 交叉核查 / 重评 inPortrait。
 * 无 IO；application 层负责读写仓库。
 */

import { rankBehaviorDomains } from '@/core/behavior/rank-behavior-domains'
import { applyCredibilityEvent } from '@/core/recall/condition-credibility'
import {
  PORTRAIT_BEHAVIOR_INITIAL,
  PORTRAIT_INFERENCE_INITIAL,
  buildPortraitFactId,
  looksLikeSiteFact,
  normalizePortraitValue,
  portraitContestedSlots,
  reevaluatePortraitFact,
  resolvePortraitFactState,
  shouldEnterPortrait,
  type PortraitFactRecord,
  type PortraitFactSource
} from '@/core/portrait/portrait-facts'
import { isPortraitFunctionalTopicAnchor } from '@/core/portrait/portrait-functional-terms'
import type { BehaviorStatsRecord } from '@/infrastructure/indexeddb/behavior-stats-types'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'

const MS_PER_DAY = 86_400_000
const CROSS_CHECK_WINDOW_DAYS = 90
const BEHAVIOR_TOP_N = 3
const BEHAVIOR_TOP10_FOR_CROSS = 10

export type CompilePortraitFactsInput = {
  ownerId: string
  existing: readonly PortraitFactRecord[]
  behaviorRows: readonly BehaviorStatsRecord[]
  notes: readonly MemoryNoteRecord[]
  nowMs: number
  nowIso: string
}

export type CompilePortraitFactsResult = {
  /** 待 upsert 的全量下一态行（含新建与更新） */
  upserts: PortraitFactRecord[]
  /** 计数：进画像 / 出画像 / 新建 / 更新 */
  stats: {
    in: number
    out: number
    created: number
    updated: number
    behaviorCandidates: number
    inferenceCandidates: number
    crossBoosted: number
    crossContradicted: number
  }
}

function emptyStats(): CompilePortraitFactsResult['stats'] {
  return {
    in: 0,
    out: 0,
    created: 0,
    updated: 0,
    behaviorCandidates: 0,
    inferenceCandidates: 0,
    crossBoosted: 0,
    crossContradicted: 0
  }
}

function upsertMap(existing: readonly PortraitFactRecord[]): Map<string, PortraitFactRecord> {
  const map = new Map<string, PortraitFactRecord>()
  for (const row of existing) {
    map.set(row.id, row)
  }
  return map
}

/**
 * 行为 top3 → 行为来源事实（初始 0.8，1 观察即可进）。
 */
function mergeBehaviorFacts(
  map: Map<string, PortraitFactRecord>,
  input: CompilePortraitFactsInput,
  stats: CompilePortraitFactsResult['stats']
): void {
  const ranked = rankBehaviorDomains(input.behaviorRows, 'favorite', input.nowMs, BEHAVIOR_TOP_N)
  stats.behaviorCandidates = ranked.length
  for (const row of ranked) {
    const value = normalizePortraitValue(row.domain)
    const id = buildPortraitFactId(input.ownerId, 'contentTerm', value)
    const source: PortraitFactSource = {
      type: 'behavior',
      ref: `behavior:${row.domain}`,
      score: PORTRAIT_BEHAVIOR_INITIAL,
      observedAt: input.nowIso
    }
    const prior = map.get(id)
    if (!prior) {
      const draft: PortraitFactRecord = {
        id,
        ownerId: input.ownerId,
        slot: 'contentTerm',
        value,
        credibility: PORTRAIT_BEHAVIOR_INITIAL,
        state: resolvePortraitFactState(PORTRAIT_BEHAVIOR_INITIAL),
        sources: [source],
        inPortrait: false,
        createdAt: input.nowIso,
        updatedAt: input.nowIso
      }
      draft.inPortrait = shouldEnterPortrait(draft)
      map.set(id, draft)
      stats.created += 1
      continue
    }
    if (prior.state === 'invalid') {
      continue
    }
    const hasBehavior = prior.sources.some(s => s.type === 'behavior' && s.ref === source.ref)
    const sources = hasBehavior ? prior.sources : [...prior.sources, source]
    // 刷新行为分：取 max(既有, 0.8)
    const credibility = Math.max(prior.credibility, PORTRAIT_BEHAVIOR_INITIAL)
    const next: PortraitFactRecord = {
      ...prior,
      credibility,
      sources,
      updatedAt: input.nowIso,
      state: resolvePortraitFactState(credibility)
    }
    next.inPortrait = shouldEnterPortrait(next)
    map.set(id, next)
    stats.updated += 1
  }
}

/**
 * Dreaming 命题 → 推断候选（初始 0.4；topicAnchor / 站点样值）。
 */
function mergeInferenceFacts(
  map: Map<string, PortraitFactRecord>,
  input: CompilePortraitFactsInput,
  stats: CompilePortraitFactsResult['stats']
): void {
  const seen = new Set<string>()
  for (const note of input.notes) {
    const candidates: string[] = []
    for (const term of note.topicAnchor) {
      const t = normalizePortraitValue(term)
      // 功能词（联系/订阅等）不生成 inference 行
      if (t && !isPortraitFunctionalTopicAnchor(t) && !isPortraitFunctionalTopicAnchor(term)) {
        candidates.push(t)
      }
    }
    // 正文里若像域名，也收一条站点推断
    const text = note.text.trim()
    const domainMatch = text.match(/\b([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\b/i)
    if (domainMatch?.[1] && looksLikeSiteFact(domainMatch[1])) {
      candidates.push(normalizePortraitValue(domainMatch[1]))
    }
    for (const value of candidates) {
      const dedupe = `${value}`
      if (seen.has(dedupe)) {
        continue
      }
      seen.add(dedupe)
      const id = buildPortraitFactId(input.ownerId, 'contentTerm', value)
      const source: PortraitFactSource = {
        type: 'inference',
        ref: `note:${note.id}`,
        score: PORTRAIT_INFERENCE_INITIAL,
        observedAt: input.nowIso
      }
      const prior = map.get(id)
      if (!prior) {
        const draft: PortraitFactRecord = {
          id,
          ownerId: input.ownerId,
          slot: 'contentTerm',
          value,
          credibility: PORTRAIT_INFERENCE_INITIAL,
          state: resolvePortraitFactState(PORTRAIT_INFERENCE_INITIAL),
          sources: [source],
          inPortrait: false,
          createdAt: input.nowIso,
          updatedAt: input.nowIso
        }
        draft.inPortrait = shouldEnterPortrait(draft)
        map.set(id, draft)
        stats.created += 1
        stats.inferenceCandidates += 1
        continue
      }
      if (prior.state === 'invalid') {
        continue
      }
      if (prior.sources.some(s => s.ref === source.ref)) {
        continue
      }
      const sources = [...prior.sources, source]
      const next: PortraitFactRecord = {
        ...prior,
        sources,
        updatedAt: input.nowIso
      }
      next.inPortrait = shouldEnterPortrait(next)
      next.state = resolvePortraitFactState(next.credibility)
      map.set(id, next)
      stats.updated += 1
      stats.inferenceCandidates += 1
    }
  }
}

/**
 * 陈述来源站点事实 ↔ behavior_stats 交叉核查（v1 仅站点类）。
 * 90 天衰减进 top10 → +0.15；零访问 → -0.10。
 */
function applyBehaviorCrossCheck(
  map: Map<string, PortraitFactRecord>,
  input: CompilePortraitFactsInput,
  stats: CompilePortraitFactsResult['stats']
): void {
  const ranked = rankBehaviorDomains(
    input.behaviorRows,
    'favorite',
    input.nowMs,
    BEHAVIOR_TOP10_FOR_CROSS
  )
  const topDomains = new Set(ranked.map(r => normalizePortraitValue(r.domain)))
  const windowStart = input.nowMs - CROSS_CHECK_WINDOW_DAYS * MS_PER_DAY
  const visitedInWindow = new Set<string>()
  for (const row of input.behaviorRows) {
    if (row.lastVisitTime >= windowStart) {
      visitedInWindow.add(normalizePortraitValue(row.domain))
    }
  }

  for (const [id, fact] of map) {
    if (fact.state === 'invalid') {
      continue
    }
    if (!looksLikeSiteFact(fact.value)) {
      continue
    }
    const hasStatement = fact.sources.some(s => s.type === 'statement')
    if (!hasStatement) {
      continue
    }
    const domain = normalizePortraitValue(fact.value)
    const inTop10 = topDomains.has(domain)
    const visited = visitedInWindow.has(domain)
    if (inTop10 && visited) {
      const credibility = applyCredibilityEvent(fact.credibility, 'crossTypeCorroboration')
      const next = {
        ...fact,
        credibility,
        updatedAt: input.nowIso,
        state: resolvePortraitFactState(credibility)
      }
      next.inPortrait = shouldEnterPortrait(next)
      map.set(id, next)
      stats.crossBoosted += 1
      stats.updated += 1
    } else if (!visited) {
      const credibility = applyCredibilityEvent(fact.credibility, 'contradiction')
      const next = {
        ...fact,
        credibility,
        updatedAt: input.nowIso,
        state: resolvePortraitFactState(credibility)
      }
      next.inPortrait = shouldEnterPortrait(next)
      map.set(id, next)
      stats.crossContradicted += 1
      stats.updated += 1
    }
  }
}

/** 纯函数编译：返回应落库的 upserts 与计数。 */
export function compilePortraitFactsCore(
  input: CompilePortraitFactsInput
): CompilePortraitFactsResult {
  const stats = emptyStats()
  const map = upsertMap(input.existing)
  const beforeIn = new Set([...map.values()].filter(f => f.inPortrait).map(f => f.id))

  mergeBehaviorFacts(map, input, stats)
  mergeInferenceFacts(map, input, stats)
  applyBehaviorCrossCheck(map, input, stats)

  const contested = portraitContestedSlots([...map.values()])
  const upserts: PortraitFactRecord[] = []
  for (const fact of map.values()) {
    const next = reevaluatePortraitFact(fact, {
      hasCloseContradiction: contested.has(fact.slot),
      nowIso: input.nowIso
    })
    upserts.push(next)
    map.set(next.id, next)
  }

  const afterIn = new Set(upserts.filter(f => f.inPortrait).map(f => f.id))
  for (const id of afterIn) {
    if (!beforeIn.has(id)) {
      stats.in += 1
    }
  }
  for (const id of beforeIn) {
    if (!afterIn.has(id)) {
      stats.out += 1
    }
  }

  return { upserts, stats }
}
