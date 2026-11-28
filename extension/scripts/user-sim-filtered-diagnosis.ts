/**
 * user-sim filtered 诊断：复刻 fuseHybridMatches 逐阶段追踪目标存活，
 * 给每个 filtered 正例互斥原因码，并量化四个反事实可回收上限。
 * 只读诊断；不改生产常量 / 行为。
 *
 * 用法：cd extension && bun run user-sim:diagnose
 */

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fuseKeywordAndSemanticPools } from '@/application/recall/backends/hybrid-recall-backend'
import { applyStoredOutcomePairsToMatches } from '@/application/recall/apply-recall-context'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_RESULT_POOL_LIMIT,
  buildRankedRecallPool,
  buildRecallResult,
  filterKeywordMatchesBeforeCollapse
} from '@/core/recall/build-recall-result'
import {
  collapseRecallMatches,
  getRecallDuplicateKey,
  recallMatchConflictsWithTopPick,
  serializeRecallDuplicateKey
} from '@/core/recall/collapse-recall-duplicates'
import {
  effectiveContentTermsForRecall,
  filterMatchesByContentTermCorroboration,
  itemCorroboratesContentTerms,
  parsedClueForTimeSoftReopen,
  shouldAttemptTimeSoftReopen,
  softPenalizeMatchesByContentTermCorroboration
} from '@/core/recall/content-term-corroboration'
import { filterMatchesByExcludeContentTerms } from '@/core/recall/exclude-content-terms'
import {
  HYBRID_KEYWORD_POOL,
  HYBRID_MIN_COSINE_SIMILARITY,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED,
  cosineSimilarity,
  rankIdsByCosineToQuery,
  scoreFromCosineSimilarity
} from '@/core/recall/hybrid-fusion'
import { RECALL_MIN_MATCH_SCORE } from '@/core/recall/keyword-filter-weights'
import {
  RECALL_TOP_PICK_MIN_SCORE,
  isGenericOnlyHitAgainstSpecificClue,
  recallTopPickBlockedByGenericPageTitleGate,
  scoreMemoryItem
} from '@/core/recall/keyword-filter'
import {
  applyParsedClueScoreBoosts,
  filterMatchesByParsedTimeRange
} from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { HYBRID_FAKE_EMBEDDING_DIM, makeFakeEmbedding } from '../tests/eval/hybrid-fake-embedding'
import { runStage2Case } from '../tests/eval/clue-chain/stage2/run-case'
import type { Stage2Task } from '../tests/eval/clue-chain/stage2/types'
import { USER_SIM_PERSONAS } from '../tests/eval/user-sim/personas'
import {
  generateUserSimDataset,
  type UserSimClueType,
  type UserSimDataset
} from '../tests/eval/user-sim/generate'
import { validateUserSimDataset } from '../tests/eval/user-sim/validate'
import { toStage2Tasks } from '../tests/eval/user-sim/to-stage2'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/user-sim/runs')

const END_ISO = '2026-11-28'
const NOW_MS = Date.parse(`${END_ISO}T12:00:00Z`)
const SEED = 42
const COLLAPSE74_LIMIT = RECALL_RESULT_POOL_LIMIT + RECALL_COLLAPSE_BACKFILL_EXTRA

type LossReason =
  | 'not_in_any_pool'
  | 'time_filtered'
  | 'collapse_lost'
  | 'delivery_corroboration'
  | 'final_pool_conflict'
  | 'final_pool_truncated'
  | 'unexplained'
  | null

type KwSubReason =
  | 'kw_below_min_score_zero'
  | 'kw_below_min_score_partial'
  | 'kw_generic_only'
  | 'kw_collapse_representative'
  | 'kw_collapse_truncated'
  | null

type SemSubReason = 'cos_below_threshold' | 'cos_rank_over_k' | null

type CollapseSubReason = 'representative' | 'truncated' | null

type StageTrace = {
  keywordRawScore: number
  keywordRawRank: number | null
  genericOnly: boolean
  keywordBeforeCollapseIn: boolean
  keywordCollapsedIn: boolean
  keywordCollapseRepId: string | null
  targetCosine: number | null
  cosineRankAll: number | null
  semanticPoolIn: boolean
  semanticLimitUsed: number
  timeFilteredKwIn: boolean
  timeFilteredSemIn: boolean
  timeRange: ParsedRecallClue['timeRange'] | null
  targetCreatedAt: string | null
  targetLastOpenedAt: string | null
  targetChromeCreatedAt: string | null
  fusedIn: boolean
  fusedPosition: number | null
  timeSoftReopen: boolean
  softRankedIn: boolean
  collapse74In: boolean
  collapse74RepId: string | null
  corroborates: boolean | null
  finalPoolIn: boolean
  finalPoolPosition: number | null
}

type CaseRecord = {
  personaId: string
  taskId: string
  clue: string
  clueType: UserSimClueType
  tier: Stage2Task['tier']
  targetId: string | null
  stage: string
  baselineRankedIds: string[]
  replicaRankedIds: string[]
  rankedIdsMatch: boolean
  reason: LossReason
  kwSubReason: KwSubReason
  semSubReason: SemSubReason
  collapseSubReason: CollapseSubReason
  stages: StageTrace | null
  counterfactuals?: {
    semanticK100: boolean
    poolLimit100: boolean
    noTopConflict: boolean
    noCorroboration: boolean
  }
}

function resolveGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function rankedIdsFromResult(result: RecallResult | null): string[] {
  if (!result) return []
  const ids: string[] = []
  if (result.topPick) ids.push(result.topPick.item.id)
  for (const match of result.alsoPossible) ids.push(match.item.id)
  return ids
}

function idInMatches(matches: readonly RecallMatch[], id: string): boolean {
  return matches.some(m => m.item.id === id)
}

function positionInMatches(matches: readonly RecallMatch[], id: string): number | null {
  const idx = matches.findIndex(m => m.item.id === id)
  return idx < 0 ? null : idx + 1
}

function dupKeyOf(item: MemoryItem): string {
  return serializeRecallDuplicateKey(getRecallDuplicateKey(item))
}

/** 诊断用：可改池上限 / 关掉佐证硬滤 / 关掉 Top 互斥（不碰生产常量）。 */
function buildRecallResultForCounterfactual(
  clue: string,
  collapsedGroups: RecallMatch[],
  options: {
    contentTerms?: readonly string[]
    poolLimit: number
    skipCorroboration: boolean
    skipTopConflict: boolean
  }
): RecallResult {
  const contentTerms = options.contentTerms
  const groups =
    !options.skipCorroboration && contentTerms && contentTerms.length > 0
      ? collapsedGroups.filter(match => itemCorroboratesContentTerms(match.item, contentTerms))
      : collapsedGroups

  if (groups.length === 0) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 0,
      clue
    }
  }

  const best = groups[0]!
  if (
    !options.skipCorroboration &&
    contentTerms &&
    contentTerms.length > 0 &&
    !itemCorroboratesContentTerms(best.item, contentTerms)
  ) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 0,
      clue
    }
  }

  const withTopConflictFilter =
    !options.skipTopConflict &&
    best.score >= RECALL_TOP_PICK_MIN_SCORE &&
    !recallTopPickBlockedByGenericPageTitleGate(clue, best.matchedFields)

  let pool: RecallMatch[]
  if (!withTopConflictFilter) {
    pool = groups.slice(0, options.poolLimit)
    return {
      outcome: 'need_a_clue',
      topPick: null,
      alsoPossible: pool,
      totalRankedCount: pool.length,
      clue
    }
  }

  pool = [best]
  for (const candidate of groups.slice(1)) {
    if (recallMatchConflictsWithTopPick(best, candidate)) continue
    pool.push(candidate)
    if (pool.length >= options.poolLimit) break
  }
  return {
    outcome: 'top_pick',
    topPick: pool[0] ?? best,
    alsoPossible: pool.slice(1),
    totalRankedCount: pool.length,
    clue
  }
}

type ReplicaOptions = {
  semanticLimitOverride?: number
  poolLimit?: number
  skipCorroboration?: boolean
  skipTopConflict?: boolean
  /** 为 true 时收集逐阶段轨迹（仅正例目标） */
  collectTrace?: boolean
  targetId?: string | null
}

type ReplicaOutput = {
  rankedIds: string[]
  result: RecallResult | null
  softRankedEmpty: boolean
  stages: StageTrace | null
  /** 中间产物，供原因归因 */
  keywordScored: RecallMatch[]
  semanticScored: RecallMatch[]
  keywordBeforeCollapse: RecallMatch[]
  fused: RecallMatch[]
  softRanked: RecallMatch[]
  collapsed: RecallMatch[]
  corroborationTerms: string[]
  timeSoftReopen: boolean
  effectiveParsed: ParsedRecallClue
  originalParsed: ParsedRecallClue
  filterClue: string
  queryVector: number[]
  semanticLimitUsed: number
  allCosineRanks: { id: string; similarity: number }[]
}

async function replicateFuseHybridMatches(input: {
  clue: string
  items: MemoryItem[]
  task: Stage2Task
  options?: ReplicaOptions
}): Promise<ReplicaOutput> {
  const opts = input.options ?? {}
  const parsed = parseRecallClue(input.clue, { nowMs: NOW_MS })
  const contentTerms = [...(parsed.contentTerms ?? [])]
  const filterClue = contentTerms.join(' ').trim() || parsed.raw
  const corroborationTerms = effectiveContentTermsForRecall(parsed)
  const queryVector = makeFakeEmbedding(input.task.embeddingAnchor, HYBRID_FAKE_EMBEDDING_DIM)

  const keywordBeforeCollapse = filterKeywordMatchesBeforeCollapse(input.items, filterClue, {})
    .map(match => applyParsedClueScoreBoosts(match, parsed))
    .filter(match => !isGenericOnlyHitAgainstSpecificClue(filterClue, match.item))

  const keywordScored = collapseRecallMatches(keywordBeforeCollapse, {
    limit: HYBRID_KEYWORD_POOL,
    noteMatchTerms: corroborationTerms
  })

  const embeddedCandidates = input.items.flatMap(item => {
    const embedding = item.clues.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) return []
    return [{ id: item.id, embedding }]
  })

  const emptyStages = null
  if (embeddedCandidates.length === 0) {
    return {
      rankedIds: [],
      result: null,
      softRankedEmpty: true,
      stages: emptyStages,
      keywordScored,
      semanticScored: [],
      keywordBeforeCollapse,
      fused: [],
      softRanked: [],
      collapsed: [],
      corroborationTerms,
      timeSoftReopen: false,
      effectiveParsed: parsed,
      originalParsed: parsed,
      filterClue,
      queryVector,
      semanticLimitUsed: 0,
      allCosineRanks: []
    }
  }

  const allCosineRanks = embeddedCandidates
    .map(c => ({
      id: c.id,
      similarity: cosineSimilarity(queryVector, c.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const semanticLimitUsed =
    opts.semanticLimitOverride ??
    (keywordScored.length === 0
      ? HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED
      : HYBRID_SEMANTIC_NEIGHBOR_LIMIT)

  const itemsById = new Map(input.items.map(item => [item.id, item]))
  const semanticScored = rankIdsByCosineToQuery(queryVector, embeddedCandidates, {
    limit: semanticLimitUsed,
    minSimilarity: HYBRID_MIN_COSINE_SIMILARITY
  }).flatMap(neighbor => {
    const item = itemsById.get(neighbor.id)
    if (!item) return []
    return [
      applyParsedClueScoreBoosts(
        {
          item,
          score: scoreFromCosineSimilarity(neighbor.similarity),
          matchedFields: ['embedding']
        },
        parsed
      )
    ]
  })

  if (semanticScored.length === 0 && keywordScored.length === 0) {
    return {
      rankedIds: [],
      result: null,
      softRankedEmpty: true,
      stages: emptyStages,
      keywordScored,
      semanticScored,
      keywordBeforeCollapse,
      fused: [],
      softRanked: [],
      collapsed: [],
      corroborationTerms,
      timeSoftReopen: false,
      effectiveParsed: parsed,
      originalParsed: parsed,
      filterClue,
      queryVector,
      semanticLimitUsed,
      allCosineRanks
    }
  }

  const fuseWithParsed = (p: ParsedRecallClue): RecallMatch[] =>
    fuseKeywordAndSemanticPools({
      keywordMatches: keywordScored,
      semanticMatches: semanticScored,
      parsed: p,
      pageContextMode: 'none'
    })

  let fused = fuseWithParsed(parsed)
  let softRanked = softPenalizeMatchesByContentTermCorroboration(
    fused,
    corroborationTerms,
    undefined
  )
  softRanked = filterMatchesByExcludeContentTerms(softRanked, parsed.excludeContentTerms)

  const hardCorroboratedCount = filterMatchesByExcludeContentTerms(
    filterMatchesByContentTermCorroboration(fused, corroborationTerms, undefined),
    parsed.excludeContentTerms
  ).length

  let effectiveParsed = parsed
  let timeSoftReopen = false
  if (shouldAttemptTimeSoftReopen(parsed, hardCorroboratedCount)) {
    timeSoftReopen = true
    effectiveParsed = parsedClueForTimeSoftReopen(parsed)
    fused = fuseWithParsed(effectiveParsed)
    softRanked = softPenalizeMatchesByContentTermCorroboration(fused, corroborationTerms, undefined)
    softRanked = filterMatchesByExcludeContentTerms(softRanked, effectiveParsed.excludeContentTerms)
  }

  if (softRanked.length === 0) {
    const stages = opts.collectTrace
      ? buildStageTrace({
          items: input.items,
          filterClue,
          targetId: opts.targetId ?? null,
          keywordBeforeCollapse,
          keywordScored,
          semanticScored,
          semanticLimitUsed,
          allCosineRanks,
          parsed,
          effectiveParsed,
          fused,
          softRanked,
          collapsed: [],
          timeSoftReopen,
          result: null,
          corroborationTerms
        })
      : null
    return {
      rankedIds: [],
      result: null,
      softRankedEmpty: true,
      stages,
      keywordScored,
      semanticScored,
      keywordBeforeCollapse,
      fused,
      softRanked,
      collapsed: [],
      corroborationTerms,
      timeSoftReopen,
      effectiveParsed,
      originalParsed: parsed,
      filterClue,
      queryVector,
      semanticLimitUsed,
      allCosineRanks
    }
  }

  const withPairs = await applyStoredOutcomePairsToMatches(softRanked, input.clue, {
    contentTerms: corroborationTerms
  })
  let afterPairs = softPenalizeMatchesByContentTermCorroboration(
    withPairs,
    corroborationTerms,
    undefined
  )
  afterPairs = filterMatchesByExcludeContentTerms(afterPairs, effectiveParsed.excludeContentTerms)

  const poolLimit = opts.poolLimit ?? RECALL_RESULT_POOL_LIMIT
  const collapseLimit = poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
  const collapsed = collapseRecallMatches(afterPairs, {
    limit: collapseLimit,
    noteMatchTerms: corroborationTerms
  })

  let result: RecallResult
  if (opts.skipCorroboration || opts.skipTopConflict || opts.poolLimit !== undefined) {
    result = buildRecallResultForCounterfactual(input.clue, collapsed, {
      contentTerms: corroborationTerms,
      poolLimit,
      skipCorroboration: Boolean(opts.skipCorroboration),
      skipTopConflict: Boolean(opts.skipTopConflict)
    })
  } else {
    result = buildRecallResult(input.clue, collapsed, {
      contentTerms: corroborationTerms
    })
  }

  if (result.outcome === 'no_match') {
    const stages = opts.collectTrace
      ? buildStageTrace({
          items: input.items,
          filterClue,
          targetId: opts.targetId ?? null,
          keywordBeforeCollapse,
          keywordScored,
          semanticScored,
          semanticLimitUsed,
          allCosineRanks,
          parsed,
          effectiveParsed,
          fused,
          softRanked: afterPairs,
          collapsed,
          timeSoftReopen,
          result: null,
          corroborationTerms
        })
      : null
    return {
      rankedIds: [],
      result: null,
      softRankedEmpty: false,
      stages,
      keywordScored,
      semanticScored,
      keywordBeforeCollapse,
      fused,
      softRanked: afterPairs,
      collapsed,
      corroborationTerms,
      timeSoftReopen,
      effectiveParsed,
      originalParsed: parsed,
      filterClue,
      queryVector,
      semanticLimitUsed,
      allCosineRanks
    }
  }

  const rankedIds = rankedIdsFromResult(result)
  const stages = opts.collectTrace
    ? buildStageTrace({
        items: input.items,
        filterClue,
        targetId: opts.targetId ?? null,
        keywordBeforeCollapse,
        keywordScored,
        semanticScored,
        semanticLimitUsed,
        allCosineRanks,
        parsed,
        effectiveParsed,
        fused,
        softRanked: afterPairs,
        collapsed,
        timeSoftReopen,
        result,
        corroborationTerms
      })
    : null

  return {
    rankedIds,
    result,
    softRankedEmpty: false,
    stages,
    keywordScored,
    semanticScored,
    keywordBeforeCollapse,
    fused,
    softRanked: afterPairs,
    collapsed,
    corroborationTerms,
    timeSoftReopen,
    effectiveParsed,
    originalParsed: parsed,
    filterClue,
    queryVector,
    semanticLimitUsed,
    allCosineRanks
  }
}

function buildStageTrace(input: {
  items: MemoryItem[]
  filterClue: string
  targetId: string | null
  keywordBeforeCollapse: RecallMatch[]
  keywordScored: RecallMatch[]
  semanticScored: RecallMatch[]
  semanticLimitUsed: number
  allCosineRanks: { id: string; similarity: number }[]
  parsed: ParsedRecallClue
  effectiveParsed: ParsedRecallClue
  fused: RecallMatch[]
  softRanked: RecallMatch[]
  collapsed: RecallMatch[]
  timeSoftReopen: boolean
  result: RecallResult | null
  corroborationTerms: string[]
}): StageTrace {
  const targetId = input.targetId
  const target = targetId ? input.items.find(i => i.id === targetId) : undefined

  let keywordRawScore = 0
  let keywordRawRank: number | null = null
  let genericOnly = false
  if (target && targetId) {
    keywordRawScore = scoreMemoryItem(target, input.filterClue).score
    genericOnly = isGenericOnlyHitAgainstSpecificClue(input.filterClue, target)
    const scored = input.items
      .map(item => ({ id: item.id, score: scoreMemoryItem(item, input.filterClue).score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    const idx = scored.findIndex(s => s.id === targetId)
    keywordRawRank = idx < 0 ? null : idx + 1
  }

  const keywordCollapsedIn = targetId ? idInMatches(input.keywordScored, targetId) : false
  let keywordCollapseRepId: string | null = null
  if (target && targetId && !keywordCollapsedIn) {
    const key = dupKeyOf(target)
    const rep = input.keywordScored.find(m => dupKeyOf(m.item) === key)
    keywordCollapseRepId = rep?.item.id ?? null
  }

  let targetCosine: number | null = null
  let cosineRankAll: number | null = null
  if (targetId) {
    const cosIdx = input.allCosineRanks.findIndex(e => e.id === targetId)
    if (cosIdx >= 0) {
      cosineRankAll = cosIdx + 1
      targetCosine = input.allCosineRanks[cosIdx]!.similarity
    }
  }

  // 时间筛：用原始 parsed（硬筛语义）；soft reopen 后 fused 可能恢复
  const kwTimed = filterMatchesByParsedTimeRange(input.keywordScored, input.parsed)
  const semTimed = filterMatchesByParsedTimeRange(input.semanticScored, input.parsed)

  const collapsedIn = targetId ? idInMatches(input.collapsed, targetId) : false
  let collapse74RepId: string | null = null
  if (target && targetId && !collapsedIn) {
    const key = dupKeyOf(target)
    const rep = input.collapsed.find(m => dupKeyOf(m.item) === key)
    collapse74RepId = rep?.item.id ?? null
  }

  const corroborates =
    target && input.corroborationTerms.length > 0
      ? itemCorroboratesContentTerms(target, input.corroborationTerms)
      : target
        ? true
        : null

  const finalIds = rankedIdsFromResult(input.result)
  const finalPoolIn = targetId ? finalIds.includes(targetId) : false
  const finalPoolPosition = targetId && finalPoolIn ? finalIds.indexOf(targetId) + 1 : null

  return {
    keywordRawScore,
    keywordRawRank,
    genericOnly,
    keywordBeforeCollapseIn: targetId ? idInMatches(input.keywordBeforeCollapse, targetId) : false,
    keywordCollapsedIn,
    keywordCollapseRepId,
    targetCosine,
    cosineRankAll,
    semanticPoolIn: targetId ? idInMatches(input.semanticScored, targetId) : false,
    semanticLimitUsed: input.semanticLimitUsed,
    timeFilteredKwIn: targetId ? idInMatches(kwTimed, targetId) : false,
    timeFilteredSemIn: targetId ? idInMatches(semTimed, targetId) : false,
    timeRange: input.parsed.timeRange ?? null,
    targetCreatedAt: target?.createdAt ?? null,
    targetLastOpenedAt: target?.clues.lastOpenedAt ?? null,
    targetChromeCreatedAt:
      target?.payload && 'chromeCreatedAt' in target.payload
        ? (target.payload.chromeCreatedAt ?? null)
        : null,
    fusedIn: targetId ? idInMatches(input.fused, targetId) : false,
    fusedPosition: targetId ? positionInMatches(input.fused, targetId) : null,
    timeSoftReopen: input.timeSoftReopen,
    softRankedIn: targetId ? idInMatches(input.softRanked, targetId) : false,
    collapse74In: collapsedIn,
    collapse74RepId,
    corroborates,
    finalPoolIn,
    finalPoolPosition
  }
}

function attributeFilteredLoss(input: {
  stages: StageTrace
  target: MemoryItem
  keywordBeforeCollapse: RecallMatch[]
  keywordScored: RecallMatch[]
  semanticScored: RecallMatch[]
  fused: RecallMatch[]
  softRanked: RecallMatch[]
  collapsed: RecallMatch[]
  originalParsed: ParsedRecallClue
  corroborationTerms: string[]
  filterClue: string
  result: RecallResult | null
  clue: string
}): {
  reason: LossReason
  kwSubReason: KwSubReason
  semSubReason: SemSubReason
  collapseSubReason: CollapseSubReason
} {
  const { stages, target } = input
  const targetId = target.id

  const inKw = stages.keywordCollapsedIn
  const inSem = stages.semanticPoolIn

  let kwSubReason: KwSubReason = null
  let semSubReason: SemSubReason = null
  let collapseSubReason: CollapseSubReason = null

  if (!inKw && !inSem) {
    // keyword 子因
    if (stages.genericOnly && stages.keywordRawScore >= RECALL_MIN_MATCH_SCORE) {
      kwSubReason = 'kw_generic_only'
    } else if (stages.keywordRawScore < RECALL_MIN_MATCH_SCORE) {
      kwSubReason =
        stages.keywordRawScore <= 0 ? 'kw_below_min_score_zero' : 'kw_below_min_score_partial'
    } else if (stages.keywordBeforeCollapseIn) {
      kwSubReason = stages.keywordCollapseRepId
        ? 'kw_collapse_representative'
        : 'kw_collapse_truncated'
    } else {
      // 分数够且非 generic，却未进 beforeCollapse——极少见，仍归 below 或 truncate 旁路
      kwSubReason = 'kw_collapse_truncated'
    }

    // semantic 子因
    const cos = stages.targetCosine
    if (cos == null || cos < HYBRID_MIN_COSINE_SIMILARITY) {
      semSubReason = 'cos_below_threshold'
    } else {
      semSubReason = 'cos_rank_over_k'
    }

    return { reason: 'not_in_any_pool', kwSubReason, semSubReason, collapseSubReason }
  }

  // 时间筛（相对原始硬筛）：池有目标，但时间筛后两池都无
  const timedHas = stages.timeFilteredKwIn || stages.timeFilteredSemIn
  if (!timedHas) {
    // soft reopen 后若 fused 已恢复目标，则首次丢失不在时间；继续往后看
    if (!stages.fusedIn && !stages.timeSoftReopen) {
      return { reason: 'time_filtered', kwSubReason, semSubReason, collapseSubReason }
    }
    if (!stages.fusedIn && stages.timeSoftReopen) {
      // soft reopen 后仍不在 fused——时间已 soft，按后续阶段；若 soft 后仍无则 unexplained 前先查 softRanked/collapse
    } else if (!stages.fusedIn) {
      return { reason: 'time_filtered', kwSubReason, semSubReason, collapseSubReason }
    }
  } else if (!stages.fusedIn) {
    // 时间筛后仍有目标却不在 fused（RRF/页上下文等）——极少，落入 unexplained
  }

  // 若原始时间筛已掉且 soft reopen 未恢复到 fused
  if (!timedHas && !stages.fusedIn && (inKw || inSem)) {
    return { reason: 'time_filtered', kwSubReason, semSubReason, collapseSubReason }
  }

  if (stages.fusedIn && !stages.collapse74In) {
    const key = dupKeyOf(target)
    const rep = input.collapsed.find(m => dupKeyOf(m.item) === key)
    collapseSubReason = rep ? 'representative' : 'truncated'
    return { reason: 'collapse_lost', kwSubReason, semSubReason, collapseSubReason }
  }

  // softRanked 空 / no_match 且 fused 有但 collapse 无：上面已 cover
  // fused 无、soft 无、但池有 → 可能 exclude 掉且 soft reopen 后仍无
  if (!stages.fusedIn && (inKw || inSem) && timedHas) {
    return { reason: 'unexplained', kwSubReason, semSubReason, collapseSubReason }
  }

  if (stages.collapse74In) {
    const corroborates =
      input.corroborationTerms.length === 0
        ? true
        : itemCorroboratesContentTerms(target, input.corroborationTerms)
    if (!corroborates) {
      return { reason: 'delivery_corroboration', kwSubReason, semSubReason, collapseSubReason }
    }

    // 佐证通过后模拟最终池
    const groups =
      input.corroborationTerms.length > 0
        ? input.collapsed.filter(m =>
            itemCorroboratesContentTerms(m.item, input.corroborationTerms)
          )
        : input.collapsed

    if (groups.length === 0 || !idInMatches(groups, targetId)) {
      return { reason: 'delivery_corroboration', kwSubReason, semSubReason, collapseSubReason }
    }

    const best = groups[0]!
    const useConflict =
      best.score >= RECALL_TOP_PICK_MIN_SCORE &&
      !recallTopPickBlockedByGenericPageTitleGate(input.clue, best.matchedFields)

    if (useConflict) {
      if (
        best.item.id !== targetId &&
        recallMatchConflictsWithTopPick(best, {
          item: target,
          score: 0,
          matchedFields: []
        })
      ) {
        // 需要用 collapsed 里目标那条做冲突判定
        const targetMatch = groups.find(m => m.item.id === targetId)
        if (targetMatch && recallMatchConflictsWithTopPick(best, targetMatch)) {
          return { reason: 'final_pool_conflict', kwSubReason, semSubReason, collapseSubReason }
        }
      }
      const pool = buildRankedRecallPool(groups, { withTopConflictFilter: true })
      if (!idInMatches(pool, targetId)) {
        // 未进池：冲突或截断
        const targetMatch = groups.find(m => m.item.id === targetId)!
        if (recallMatchConflictsWithTopPick(best, targetMatch)) {
          return { reason: 'final_pool_conflict', kwSubReason, semSubReason, collapseSubReason }
        }
        return { reason: 'final_pool_truncated', kwSubReason, semSubReason, collapseSubReason }
      }
    } else {
      const pool = groups.slice(0, RECALL_RESULT_POOL_LIMIT)
      if (!idInMatches(pool, targetId)) {
        return { reason: 'final_pool_truncated', kwSubReason, semSubReason, collapseSubReason }
      }
    }

    // 佐证+池内却 baseline filtered？→ unexplained
    return { reason: 'unexplained', kwSubReason, semSubReason, collapseSubReason }
  }

  // collapse 无目标但 fused 也无：可能 exclude / soft 空
  if (!stages.collapse74In && stages.softRankedIn === false && stages.fusedIn) {
    collapseSubReason = 'truncated'
    return { reason: 'collapse_lost', kwSubReason, semSubReason, collapseSubReason }
  }

  return { reason: 'unexplained', kwSubReason, semSubReason, collapseSubReason }
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

function printTable(
  title: string,
  rows: Record<string, Record<string, number>>,
  colKeys: string[]
) {
  console.log(`\n=== ${title} ===`)
  const rowKeys = Object.keys(rows).sort()
  const header = ['', ...colKeys, 'total']
  console.log(header.join('\t'))
  for (const rk of rowKeys) {
    const row = rows[rk]!
    let total = 0
    const cells = colKeys.map(ck => {
      const v = row[ck] ?? 0
      total += v
      return String(v)
    })
    console.log([rk, ...cells, String(total)].join('\t'))
  }
}

export async function run(): Promise<void> {
  const head = resolveGitHead()
  const startedAt = new Date()
  const caseRecords: CaseRecord[] = []
  let mismatch: CaseRecord | null = null

  for (const persona of USER_SIM_PERSONAS) {
    const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: persona.id })
    const problems = validateUserSimDataset(data)
    if (problems.length > 0) {
      throw new Error(`user-sim validate failed for ${persona.id}: ${problems.join('; ')}`)
    }
    const tasks = toStage2Tasks(data)
    const queryByTaskId = new Map(
      data.groundTruth.queries.map(q => [`${data.meta.persona}:${q.id}`, q] as const)
    )

    for (const task of tasks) {
      const baseline = await runStage2Case({
        task,
        corpus: data.memoryItems,
        nowMs: NOW_MS
      })
      const q = queryByTaskId.get(task.id)
      const clueType: UserSimClueType = q?.type ?? (task.tier === 'negative' ? 'negative' : 'vague')

      const replica = await replicateFuseHybridMatches({
        clue: task.clue,
        items: [...data.memoryItems],
        task,
        options: {
          collectTrace: true,
          targetId: task.targetId
        }
      })

      const rankedIdsMatch =
        baseline.rankedIds.length === replica.rankedIds.length &&
        baseline.rankedIds.every((id, i) => id === replica.rankedIds[i])

      const record: CaseRecord = {
        personaId: persona.id,
        taskId: task.id,
        clue: task.clue,
        clueType,
        tier: task.tier,
        targetId: task.targetId,
        stage: baseline.stage,
        baselineRankedIds: baseline.rankedIds,
        replicaRankedIds: replica.rankedIds,
        rankedIdsMatch,
        reason: null,
        kwSubReason: null,
        semSubReason: null,
        collapseSubReason: null,
        stages: replica.stages
      }

      if (!rankedIdsMatch && !mismatch) {
        mismatch = record
        console.error('HARD FAIL: rankedIds mismatch', {
          taskId: task.id,
          persona: persona.id,
          baseline: baseline.rankedIds,
          replica: replica.rankedIds,
          stages: replica.stages
        })
        // 继续收集本案完整记录后中止写出
        caseRecords.push(record)
        throw new Error(
          `硬验收失败：首个不一致案 ${persona.id} / ${task.id}；baseline=${JSON.stringify(baseline.rankedIds)} replica=${JSON.stringify(replica.rankedIds)}`
        )
      }

      if (baseline.stage === 'filtered' && task.targetId) {
        const target = data.memoryItems.find(i => i.id === task.targetId)
        if (!target || !replica.stages) {
          record.reason = 'unexplained'
        } else {
          const attr = attributeFilteredLoss({
            stages: replica.stages,
            target,
            keywordBeforeCollapse: replica.keywordBeforeCollapse,
            keywordScored: replica.keywordScored,
            semanticScored: replica.semanticScored,
            fused: replica.fused,
            softRanked: replica.softRanked,
            collapsed: replica.collapsed,
            originalParsed: replica.originalParsed,
            corroborationTerms: replica.corroborationTerms,
            filterClue: replica.filterClue,
            result: replica.result,
            clue: task.clue
          })
          record.reason = attr.reason
          record.kwSubReason = attr.kwSubReason
          record.semSubReason = attr.semSubReason
          record.collapseSubReason = attr.collapseSubReason
        }

        // 四个反事实
        const cfSem = await replicateFuseHybridMatches({
          clue: task.clue,
          items: [...data.memoryItems],
          task,
          options: { semanticLimitOverride: HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED }
        })
        const cfPool = await replicateFuseHybridMatches({
          clue: task.clue,
          items: [...data.memoryItems],
          task,
          options: { poolLimit: 100 }
        })
        const cfConflict = await replicateFuseHybridMatches({
          clue: task.clue,
          items: [...data.memoryItems],
          task,
          options: { skipTopConflict: true }
        })
        const cfCorr = await replicateFuseHybridMatches({
          clue: task.clue,
          items: [...data.memoryItems],
          task,
          options: { skipCorroboration: true }
        })
        record.counterfactuals = {
          semanticK100: cfSem.rankedIds.includes(task.targetId),
          poolLimit100: cfPool.rankedIds.includes(task.targetId),
          noTopConflict: cfConflict.rankedIds.includes(task.targetId),
          noCorroboration: cfCorr.rankedIds.includes(task.targetId)
        }
      }

      caseRecords.push(record)
    }

    const filteredHere = caseRecords.filter(
      c => c.personaId === persona.id && c.stage === 'filtered'
    ).length
    console.log(`diagnose · ${persona.id} · cases=${tasks.length} · filtered=${filteredHere}`)
  }

  // 负例反事实：去掉 Top 冲突 / 去掉佐证 → false_hit 增量
  let negBaselineFh = 0
  let negCfConflictFh = 0
  let negCfCorrFh = 0
  for (const persona of USER_SIM_PERSONAS) {
    const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: persona.id })
    const tasks = toStage2Tasks(data).filter(t => t.tier === 'negative')
    for (const task of tasks) {
      const baseline = await runStage2Case({ task, corpus: data.memoryItems, nowMs: NOW_MS })
      if (baseline.rankedIds.length > 0) negBaselineFh++

      const cfConflict = await replicateFuseHybridMatches({
        clue: task.clue,
        items: [...data.memoryItems],
        task,
        options: { skipTopConflict: true }
      })
      if (cfConflict.rankedIds.length > 0) negCfConflictFh++

      const cfCorr = await replicateFuseHybridMatches({
        clue: task.clue,
        items: [...data.memoryItems],
        task,
        options: { skipCorroboration: true }
      })
      if (cfCorr.rankedIds.length > 0) negCfCorrFh++
    }
  }

  const filtered = caseRecords.filter(c => c.stage === 'filtered')
  const unexplained = filtered.filter(c => c.reason === 'unexplained')
  if (unexplained.length > 0) {
    console.error('unexplained > 0；首案:', unexplained[0])
    throw new Error(`unexplained=${unexplained.length}，须为 0`)
  }

  const reasons: LossReason[] = [
    'not_in_any_pool',
    'time_filtered',
    'collapse_lost',
    'delivery_corroboration',
    'final_pool_conflict',
    'final_pool_truncated'
  ]

  const reasonByClueType: Record<string, Record<string, number>> = {}
  const reasonByPersona: Record<string, Record<string, number>> = {}
  const reasonCounts: Record<string, number> = {}
  for (const r of reasons) reasonCounts[r] = 0

  for (const c of filtered) {
    const reason = c.reason!
    bump(reasonCounts, reason)
    reasonByClueType[c.clueType] ??= {}
    bump(reasonByClueType[c.clueType]!, reason)
    reasonByPersona[c.personaId] ??= {}
    bump(reasonByPersona[c.personaId]!, reason)
  }

  const notInPool = filtered.filter(c => c.reason === 'not_in_any_pool')
  const kwSubMatrix: Record<string, number> = {}
  const semSubMatrix: Record<string, number> = {}
  const kwSemCross: Record<string, Record<string, number>> = {}
  for (const c of notInPool) {
    const kw = c.kwSubReason ?? 'unknown'
    const sem = c.semSubReason ?? 'unknown'
    bump(kwSubMatrix, kw)
    bump(semSubMatrix, sem)
    kwSemCross[kw] ??= {}
    bump(kwSemCross[kw]!, sem)
  }

  const collapseSub: Record<string, number> = {}
  for (const c of filtered.filter(x => x.reason === 'collapse_lost')) {
    bump(collapseSub, c.collapseSubReason ?? 'unknown')
  }

  const cfRecover = {
    semanticK100: filtered.filter(c => c.counterfactuals?.semanticK100).length,
    poolLimit100: filtered.filter(c => c.counterfactuals?.poolLimit100).length,
    noTopConflict: filtered.filter(c => c.counterfactuals?.noTopConflict).length,
    noCorroboration: filtered.filter(c => c.counterfactuals?.noCorroboration).length
  }

  const counterfactuals = {
    filteredRecovered: cfRecover,
    filteredTotal: filtered.length,
    negativeFalseHit: {
      baseline: negBaselineFh,
      noTopConflict: negCfConflictFh,
      noCorroboration: negCfCorrFh,
      noTopConflictDelta: negCfConflictFh - negBaselineFh,
      noCorroborationDelta: negCfCorrFh - negBaselineFh
    }
  }

  const hardAcceptMatched = caseRecords.every(c => c.rankedIdsMatch)
  const report = {
    schemaVersion: 1,
    kind: 'user-sim-filtered-diagnosis',
    head,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    seed: SEED,
    endIso: END_ISO,
    nowMs: NOW_MS,
    hardAccept: {
      totalCases: caseRecords.length,
      rankedIdsMatch: hardAcceptMatched,
      expectedCases: 1040
    },
    aggregates: {
      filteredTotal: filtered.length,
      reasonCounts,
      reasonByClueType,
      reasonByPersona,
      notInAnyPool: {
        count: notInPool.length,
        kwSubMatrix,
        semSubMatrix,
        kwSemCross
      },
      collapseLostSub: collapseSub,
      unexplained: unexplained.length,
      counterfactuals
    },
    cases: caseRecords
  }

  mkdirSync(runsDir, { recursive: true })
  const outPath = resolve(runsDir, 'filtered-diagnosis.json')
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`\n硬验收: ${hardAcceptMatched ? 'PASS' : 'FAIL'} (${caseRecords.length}/1040)`)
  console.log(`filtered=${filtered.length} unexplained=${unexplained.length}`)
  console.log('原因合计:', JSON.stringify(reasonCounts))
  printTable('原因 × clueType', reasonByClueType, reasons as string[])
  printTable('原因 × persona', reasonByPersona, reasons as string[])
  console.log('\n=== not_in_any_pool 子因矩阵 (kw × sem) ===')
  printTable('kw×sem', kwSemCross, Object.keys(semSubMatrix).sort())
  console.log('kwSub:', JSON.stringify(kwSubMatrix))
  console.log('semSub:', JSON.stringify(semSubMatrix))
  console.log('collapse_lost 子因:', JSON.stringify(collapseSub))
  console.log('\n=== 反事实 ===')
  console.log(JSON.stringify(counterfactuals, null, 2))
  console.log(`wrote → ${outPath}`)

  if (Object.values(reasonCounts).reduce((a, b) => a + b, 0) !== filtered.length) {
    throw new Error('原因计数之和 ≠ filtered 总数')
  }
}
