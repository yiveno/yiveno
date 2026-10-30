/**
 * L2 召回消融：固定 goldParsed，比较 keyword / semantic / hybrid 的候选覆盖。
 *
 * **硬规则：**
 * - 不得调用 `parseRecallClue` / LLM；理解快照只来自用例 `goldParsed`。
 * - Semantic / Hybrid **必须**经真实 `embedClient`（Worker bge-m3）；禁止 fake / embeddingAnchor。
 * - 排序位次问题留给 Phase C；本层只报 Recall@K 与是否进候选。
 */

import { fuseKeywordAndSemanticPools } from '@/application/recall/backends/hybrid-recall-backend'
import {
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_RESULT_POOL_LIMIT,
  filterKeywordMatchesBeforeCollapse
} from '@/core/recall/build-recall-result'
import { buildClueEmbeddingText } from '@/core/recall/build-clue-embedding-text'
import { collapseRecallMatches } from '@/core/recall/collapse-recall-duplicates'
import {
  effectiveContentTermsForRecall,
  softPenalizeMatchesByContentTermCorroboration
} from '@/core/recall/content-term-corroboration'
import {
  filterMatchesByExcludeContentTerms,
  listExcludeTermsHittingItem,
  normalizeExcludeContentTerms
} from '@/core/recall/exclude-content-terms'
import {
  meanMrr,
  meanNdcgAtK,
  meanRecallAtK,
  mrrContribution,
  ndcgAtK,
  recallAtK,
  stabilizeRankedIds
} from '@/core/recall/eval/metrics'
import {
  createEmbedTelemetryCollector,
  summarizeNegativeFalsePositives,
  type EmbedTelemetrySummary,
  type NegativeFalsePositiveStats
} from '@/core/recall/eval/retrieval-ablation-embed-telemetry'
import {
  RETRIEVAL_ABLATION_CASES,
  type RetrievalAblationCase,
  type RetrievalAblationScenario
} from '@/core/recall/eval/retrieval-ablation-cases'
import {
  ablationCorpusFingerprint,
  assertAblationCorpusHasNoEmbeddings,
  buildRetrievalAblationCorpus,
  RETRIEVAL_ABLATION_NOW_MS
} from '@/core/recall/eval/retrieval-ablation-corpus'
import { buildEmbeddingTextFromMemoryItem } from '@/core/memory/build-embedding-text'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED,
  rankIdsByCosineToQuery,
  scoreFromCosineSimilarity,
  WORKER_EMBEDDING_MODEL_HINT
} from '@/core/recall/eval/retrieval-ablation-fusion-constants'
import { isGenericOnlyHitAgainstSpecificClue } from '@/core/recall/keyword-filter'
import {
  applyParsedClueScoreBoosts,
  buildFilterClueFromParsed,
  filterMatchesByParsedTimeRange,
  recallByKeywordWithParsedClue
} from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '@/core/recall/recall-result'

/** 与 hybrid-recall-backend 内 HYBRID_KEYWORD_POOL 对齐（评测侧常量，防循环依赖）。 */
const HYBRID_KEYWORD_POOL = 100

export type RetrievalAblationStrategy = 'keyword' | 'semantic' | 'hybrid'

/**
 * 真实 Embedding 客户端（须打 Worker `/api/ai/embed` · bge-m3）。
 * 禁止传入 hash fake。
 */
export interface RetrievalAblationEmbedClient {
  /** 须为 `@cf/baai/bge-m3`（或与生产一致的 model 字符串） */
  model: string
  embedTexts: (texts: readonly string[]) => Promise<number[][]>
}

export interface RunRetrievalAblationOptions {
  cases?: readonly RetrievalAblationCase[]
  corpus?: MemoryItem[]
  nowMs?: number
  /**
   * 真实 embed 客户端。缺省时仅允许跑 `keyword`；
   * 请求 semantic/hybrid 将抛错（不得静默降级 fake）。
   */
  embedClient?: RetrievalAblationEmbedClient
  /** 默认三策略；可缩为 ['keyword'] 做无网 CI */
  strategies?: readonly RetrievalAblationStrategy[]
}

export interface RetrievalAblationStrategyCaseResult {
  strategy: RetrievalAblationStrategy
  /** 主表：硬过滤后有序 id */
  rankedIds: string[]
  candidateCount: number
  /** 归因列 A：硬过滤前有序 id（不改主分母） */
  rankedIdsBeforeExclude: string[]
  excludeDiagnostics: RetrievalAblationExcludeDiagnostics
  /** 目标是否在全候选列表（未截断 K；滤后） */
  goldInCandidates: boolean
  recallAt1: boolean
  recallAt5: boolean
  recallAt10: boolean
  /** 单查询 MRR 贡献（hit 题）；负例恒 0 */
  mrr: number
  /** 单查询 nDCG@5（hit 题）；负例恒 0 */
  ndcgAt5: number
  /** 单查询 nDCG@10（hit 题）；负例恒 0 */
  ndcgAt10: number
  rank: number | null
  /**
   * 仅负例有意义：目标不该进前 missK 却进了 → true。
   * hit 题恒为 false（不参与负例误报率分母）。主表=滤后。
   */
  negativeFalsePositive: boolean
  /** 负例归因：滤前 FP（策略自身） */
  negativeFalsePositiveBeforeExclude: boolean
  /** 负例：滤前 FP 且滤后非 FP → 排除机制挡住误报 */
  excludePreventedFp: boolean
  /**
   * hit：
   * - candidate_miss = 目标不在全候选列表
   * - in_pool_outside_top5 = 在列表内但 rank>5（≠「未进 Top1」）
   * - not_applicable = 已在 Recall@5 内（含 rank=2..5；未进 Top1 用 Recall@1/MRR 看，不进本字段）
   * miss：expectation_failed | absent_honest
   */
  observedStage:
    | 'candidate_miss'
    | 'in_pool_outside_top5'
    | 'not_applicable'
    | 'expectation_failed'
    | 'absent_honest'
  summaryZh: string
}

export interface RetrievalAblationCaseResult {
  caseId: string
  gate: RetrievalAblationCase['gate']
  scenario: RetrievalAblationScenario
  labelConfidence: RetrievalAblationCase['labelConfidence']
  goldReviewStatus: 'stable' | 'pending_review'
  judgmentZh: string
  labelAmbiguityZh?: string
  expectationKind: RetrievalAblationCase['expectation']['kind']
  expectedId: string
  missK: number | null
  goldParsed: ParsedRecallClue
  clueEmbeddingText: string
  byStrategy: Record<RetrievalAblationStrategy, RetrievalAblationStrategyCaseResult | null>
  /**
   * 负例：各策略是否误报是否一致。
   * hit 题为 null。
   */
  negativeStrategyDisagreement: boolean | null
}

/** 一套分母口径下的计数（禁止与另一口径混用）。 */
export interface RetrievalAblationDenominatorView {
  /** include = 含 ambiguous；clear_only = 仅 labelConfidence=clear */
  mode: 'include' | 'clear_only'
  hitCaseCount: number
  negativeCaseCount: number
  ambiguousCaseCount: number
  pendingReviewCaseCount: number
  aggregateHitCases: Record<RetrievalAblationStrategy, RetrievalAblationHitAggregate | null>
  aggregateNegative: Record<RetrievalAblationStrategy, NegativeFalsePositiveStats | null>
}

export interface RetrievalAblationHitAggregate {
  recallAt1: number | null
  recallAt5: number | null
  recallAt10: number | null
  mrr: number | null
  ndcgAt5: number | null
  ndcgAt10: number | null
  denominator: number
  /** 目标未进全候选列表（覆盖失败） */
  candidateMissCount: number
  /**
   * 已进候选但 rank>5（未进 Recall@5）。
   * **不是**「未排第一」计数；rank∈{2,3,4,5} 计入 `inPoolNotTop1Count`，不进本字段。
   */
  inPoolOutsideTop5Count: number
  /**
   * 已进候选且 2≤rank≤5（覆盖成功、Top1 失败）。
   * 与 Recall@1 缺口对齐；旧名 rankWrong 易误读为「非 Top1」，已废弃。
   */
  inPoolNotTop1Count: number
  /** R@5 成功（rank≤5） */
  recallAt5HitCount: number
}

export interface RetrievalAblationNegativeCaseDetail {
  caseId: string
  scenario: RetrievalAblationScenario
  labelConfidence: RetrievalAblationCase['labelConfidence']
  forbiddenId: string
  k: number
  ranksByStrategy: Record<RetrievalAblationStrategy, number | null>
  falsePositiveByStrategy: Record<RetrievalAblationStrategy, boolean>
  falsePositiveBeforeExcludeByStrategy: Record<RetrievalAblationStrategy, boolean>
  excludePreventedFpByStrategy: Record<RetrievalAblationStrategy, boolean>
  /** 至少一策略误报且并非三策略同真/同假 */
  strategiesDisagree: boolean
  anyFalsePositive: boolean
}

export interface RetrievalAblationHybridVsProduction {
  outcomePairs: 'excluded'
  sameDomainBoost: 'excluded'
  candidateTruncation: 'aligned_constants'
  timeSoftReopenOnEmptyCorroboration: 'excluded'
  keywordFallbackWhenEmpty: 'excluded'
  llmFramingPolish: 'excluded'
  understanding: 'frozen_goldParsed'
  /** B2 对齐：离线三策略出口共用生产纯函数硬过滤 */
  excludeHardFilter: 'aligned_filterMatchesByExcludeContentTerms'
  noteZh: string
}

/** 排除硬过滤诊断（编排内 vs 出口新增分计；禁止双倍归因）。 */
export interface RetrievalAblationExcludeDiagnostics {
  excludeContentTerms: string[]
  candidateCountBeforeExclude: number
  /** Keyword：相对 strip-exclude 预跑，编排内已剔除数；Semantic/Hybrid：0 */
  orchestratorInternalExcludedCount: number
  /** 出口 filter 相对「送入出口的列表」新增剔除数（Keyword 幂等时须为 0） */
  exitNewExcludedCount: number
  /** before→after 总剔除；须 = orchestratorInternal + exitNew */
  excludedCount: number
  candidateCountAfterExclude: number
  excluded: Array<{
    id: string
    rankBefore: number
    hitExcludeTerms: string[]
  }>
}

export interface RetrievalAblationReport {
  meta: {
    nowMs: number
    corpusFingerprint: string
    caseCount: number
    hitCaseCount: number
    negativeCaseCount: number
    ambiguousLabelCaseCount: number
    scenarioCoverage: Partial<Record<RetrievalAblationScenario, number>>
    strategies: RetrievalAblationStrategy[]
    embedModel: string | null
    embedTelemetry: EmbedTelemetrySummary | null
    missPolicy: 'include_miss_as_zero'
    /**
     * 主报告分母口径：`include` = ambiguous 仍计入（裁定保留）。
     * clear-only 对照见 `denominatorViews.clearOnly`，禁止与主口径混用。
     */
    ambiguousInDenominator: 'include'
    hybridVsProduction: RetrievalAblationHybridVsProduction
    /** 已知与生产路径的差异（诚实披露） */
    knownDeltasZh: string[]
  }
  cases: RetrievalAblationCaseResult[]
  /**
   * 主口径（include）：仅 expectation.kind=hit 的子集。
   * 与 `denominatorViews.include.aggregateHitCases` 同值。
   */
  aggregateHitCases: Record<RetrievalAblationStrategy, RetrievalAblationHitAggregate | null>
  /** 主口径负例误报率（与 Recall@K 分计） */
  aggregateNegative: Record<RetrievalAblationStrategy, NegativeFalsePositiveStats | null>
  /** include + clear_only 两套口径（分母与指标禁止混用） */
  denominatorViews: {
    include: RetrievalAblationDenominatorView
    clearOnly: RetrievalAblationDenominatorView
  }
  /** 负例逐案（误报目标 / rank / 策略分歧） */
  negativeCaseDetails: RetrievalAblationNegativeCaseDetail[]
}

const HYBRID_VS_PRODUCTION: RetrievalAblationHybridVsProduction = {
  outcomePairs: 'excluded',
  sameDomainBoost: 'excluded',
  candidateTruncation: 'aligned_constants',
  timeSoftReopenOnEmptyCorroboration: 'excluded',
  keywordFallbackWhenEmpty: 'excluded',
  llmFramingPolish: 'excluded',
  understanding: 'frozen_goldParsed',
  excludeHardFilter: 'aligned_filterMatchesByExcludeContentTerms',
  noteZh:
    '实验 Hybrid=冻结理解 + RRF/截断/时间硬筛/佐证软罚 + 出口 exclude 硬过滤；不含 Outcome 对、同域加成、佐证空窗 time soft 回退、空池关键词降级、LLM framing。不可外推生产端到端收益。'
}

const KNOWN_DELTAS_ZH = [
  'Hybrid：Outcome 对 = 未纳入（生产融合后 applyStoredOutcomePairs）',
  'Hybrid：同域加成 = 未纳入（pageContextMode=none）',
  'Hybrid：候选截断 = 已纳入（与生产同常量族 keyword≈100 / semantic neighbor / collapse）',
  'Hybrid：过滤 = 部分纳入（时间硬筛、槽位软加成、佐证软罚）+ 出口 exclude 硬过滤（与生产同函数）；未纳入佐证空窗 time soft 回退与空池关键词降级',
  'Semantic = 余弦 Top-K + 时间硬筛 + 槽位软加 + 出口 exclude 硬过滤；无 RRF；非生产终排',
  'Keyword = recallByKeywordWithParsedClue（编排内已 exclude）+ 出口同函数幂等再滤；诊断分计编排内/出口新增',
  'exclude 匹配 = 词项/屈折/连字符短语，≠完整语义理解；冻结槽依据用户意图，非生产 LLM/规则输出',
  '本实验回答固定 goldParsed 下覆盖与位次；不可外推生产 Recall 成功率或 §5.9 TTE'
]

function requireRealEmbedClient(
  client: RetrievalAblationEmbedClient | undefined,
  strategy: RetrievalAblationStrategy
): RetrievalAblationEmbedClient {
  if (!client) {
    throw new Error(
      `[retrieval-ablation] 策略 ${strategy} 需要真实 embedClient；禁止 fake/embeddingAnchor 替身`
    )
  }
  if (client.model !== WORKER_EMBEDDING_MODEL_HINT) {
    throw new Error(
      `[retrieval-ablation] embedClient.model 须为 ${WORKER_EMBEDDING_MODEL_HINT}，实际=${client.model}`
    )
  }
  return client
}

async function callEmbedOrThrow(
  client: RetrievalAblationEmbedClient,
  texts: readonly string[],
  telemetry: ReturnType<typeof createEmbedTelemetryCollector>,
  contextZh: string
): Promise<number[][]> {
  const started = Date.now()
  try {
    const vectors = await client.embedTexts(texts)
    if (vectors.length !== texts.length) {
      throw new Error(`条数不符：期望 ${texts.length} 实际 ${vectors.length}`)
    }
    for (let i = 0; i < vectors.length; i += 1) {
      const vector = vectors[i]
      if (!vector?.length) {
        throw new Error(`空向量 index=${i}（${contextZh}）；禁止当成功续算`)
      }
    }
    const dim = vectors[0]!.length
    telemetry.record({
      textCount: texts.length,
      model: client.model,
      dim,
      latencyMs: Date.now() - started,
      outcome: 'ok'
    })
    return vectors
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : String(error)
    telemetry.record({
      textCount: texts.length,
      model: client.model,
      dim: 0,
      latencyMs: Date.now() - started,
      outcome: 'error',
      errorCode
    })
    throw new Error(`[retrieval-ablation] embed 失败（${contextZh}）：${errorCode}`)
  }
}

async function embedCorpusItems(
  items: MemoryItem[],
  client: RetrievalAblationEmbedClient,
  telemetry: ReturnType<typeof createEmbedTelemetryCollector>
): Promise<MemoryItem[]> {
  const texts = items.map(item => buildEmbeddingTextFromMemoryItem(item))
  const vectors: number[][] = []
  // Worker 单批最多 8 条
  const BATCH = 8
  for (let offset = 0; offset < texts.length; offset += BATCH) {
    const slice = texts.slice(offset, offset + BATCH)
    const batchVectors = await callEmbedOrThrow(client, slice, telemetry, `corpus batch@${offset}`)
    vectors.push(...batchVectors)
  }
  return items.map((item, index) => {
    const embedding = vectors[index]!
    return {
      ...item,
      clues: {
        ...item.clues,
        embedding: [...embedding],
        embeddingModel: client.model,
        embeddingDim: embedding.length
      }
    }
  })
}

function rankedIdsFromMatches(matches: readonly RecallMatch[]): string[] {
  return stabilizeRankedIds(matches.map(match => match.item.id))
}

function matchesFromKeywordResult(
  items: MemoryItem[],
  displayClue: string,
  parsed: ParsedRecallClue,
  nowMs: number
): RecallMatch[] {
  const result = recallByKeywordWithParsedClue(items, displayClue, {
    nowMs,
    parsed,
    candidateLimit: RECALL_RESULT_POOL_LIMIT
  })
  const matches: RecallMatch[] = []
  if (result.topPick) {
    matches.push(result.topPick)
  }
  matches.push(...result.alsoPossible)
  return matches
}

/** 去掉 exclude 槽，供 Keyword 预跑「滤前池」（不改生产编排）。 */
function stripExcludeContentTerms(parsed: ParsedRecallClue): ParsedRecallClue {
  const { excludeContentTerms: _removed, ...rest } = parsed
  return rest
}

/**
 * 出口硬过滤 + 诊断分计。
 * - matchesEnteringExit：送入出口 filter 的列表（Keyword=编排已滤输出；Sem/Hyb=策略原生输出）
 * - matchesBeforeAnyExclude：真正「滤前」池（Keyword=strip 预跑；Sem/Hyb=与 entering 相同）
 */
export function applyAblationExcludeHardFilter(
  matchesEnteringExit: readonly RecallMatch[],
  excludeContentTerms: readonly string[] | undefined,
  matchesBeforeAnyExclude: readonly RecallMatch[]
): {
  matchesAfter: RecallMatch[]
  diagnostics: RetrievalAblationExcludeDiagnostics
} {
  const terms = normalizeExcludeContentTerms(excludeContentTerms)
  const beforeIds = rankedIdsFromMatches(matchesBeforeAnyExclude)
  const enteringIds = new Set(rankedIdsFromMatches(matchesEnteringExit))
  const matchesAfter = filterMatchesByExcludeContentTerms(
    [...matchesEnteringExit],
    excludeContentTerms
  )
  const afterIds = new Set(rankedIdsFromMatches(matchesAfter))

  const orchestratorInternalExcludedCount = matchesBeforeAnyExclude.filter(
    match => !enteringIds.has(match.item.id)
  ).length
  const exitNewExcludedCount = matchesEnteringExit.filter(
    match => !afterIds.has(match.item.id)
  ).length
  const excludedCount = matchesBeforeAnyExclude.filter(match => !afterIds.has(match.item.id)).length
  if (excludedCount !== orchestratorInternalExcludedCount + exitNewExcludedCount) {
    throw new Error(
      `[retrieval-ablation] exclude 诊断分计不守恒：total=${excludedCount}` +
        ` orch=${orchestratorInternalExcludedCount} exit=${exitNewExcludedCount}`
    )
  }

  const excluded = matchesBeforeAnyExclude
    .filter(match => !afterIds.has(match.item.id))
    .map(match => {
      const rankBefore = beforeIds.indexOf(match.item.id) + 1
      return {
        id: match.item.id,
        rankBefore,
        hitExcludeTerms: listExcludeTermsHittingItem(match.item, terms)
      }
    })

  return {
    matchesAfter,
    diagnostics: {
      excludeContentTerms: terms,
      candidateCountBeforeExclude: matchesBeforeAnyExclude.length,
      orchestratorInternalExcludedCount,
      exitNewExcludedCount,
      excludedCount,
      candidateCountAfterExclude: matchesAfter.length,
      excluded
    }
  }
}

function runKeywordStrategyPools(
  items: MemoryItem[],
  displayClue: string,
  goldParsed: ParsedRecallClue,
  nowMs: number
): { beforeAnyExclude: RecallMatch[]; enteringExit: RecallMatch[] } {
  const beforeAnyExclude = matchesFromKeywordResult(
    items,
    displayClue,
    stripExcludeContentTerms(goldParsed),
    nowMs
  )
  const enteringExit = matchesFromKeywordResult(items, displayClue, goldParsed, nowMs)
  return { beforeAnyExclude, enteringExit }
}

function runSemanticStrategyMatches(
  items: MemoryItem[],
  goldParsed: ParsedRecallClue,
  queryVector: number[]
): RecallMatch[] {
  const embeddedCandidates = items.flatMap(item => {
    const embedding = item.clues.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return []
    }
    return [{ id: item.id, embedding }]
  })
  const neighbors = rankIdsByCosineToQuery(queryVector, embeddedCandidates, {
    limit: HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED
  })
  const itemsById = new Map(items.map(item => [item.id, item]))
  let matches: RecallMatch[] = neighbors.flatMap(neighbor => {
    const item = itemsById.get(neighbor.id)
    if (!item) {
      return []
    }
    return [
      applyParsedClueScoreBoosts(
        {
          item,
          score: scoreFromCosineSimilarity(neighbor.similarity),
          matchedFields: ['embedding']
        },
        goldParsed
      )
    ]
  })
  matches = filterMatchesByParsedTimeRange(matches, goldParsed)
  matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })
  return matches
}

function runHybridStrategyMatches(
  items: MemoryItem[],
  displayClue: string,
  goldParsed: ParsedRecallClue,
  queryVector: number[]
): RecallMatch[] {
  const filterClue = buildFilterClueFromParsed(goldParsed) || displayClue
  const keywordScored = collapseRecallMatches(
    filterKeywordMatchesBeforeCollapse(items, filterClue)
      .map(match => applyParsedClueScoreBoosts(match, goldParsed))
      .filter(match => !isGenericOnlyHitAgainstSpecificClue(filterClue, match.item)),
    { limit: HYBRID_KEYWORD_POOL }
  )

  const embeddedCandidates = items.flatMap(item => {
    const embedding = item.clues.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return []
    }
    return [{ id: item.id, embedding }]
  })
  const semanticLimit =
    keywordScored.length === 0
      ? HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED
      : HYBRID_SEMANTIC_NEIGHBOR_LIMIT
  const itemsById = new Map(items.map(item => [item.id, item]))
  const semanticScored = rankIdsByCosineToQuery(queryVector, embeddedCandidates, {
    limit: semanticLimit
  }).flatMap(neighbor => {
    const item = itemsById.get(neighbor.id)
    if (!item) {
      return []
    }
    return [
      applyParsedClueScoreBoosts(
        {
          item,
          score: scoreFromCosineSimilarity(neighbor.similarity),
          matchedFields: ['embedding']
        },
        goldParsed
      )
    ]
  })

  if (semanticScored.length === 0 && keywordScored.length === 0) {
    return []
  }

  const fused = fuseKeywordAndSemanticPools({
    keywordMatches: keywordScored,
    semanticMatches: semanticScored,
    parsed: goldParsed,
    pageContextMode: 'none'
  })
  const corroborationTerms = effectiveContentTermsForRecall(goldParsed)
  const corroborated = softPenalizeMatchesByContentTermCorroboration(fused, corroborationTerms)
  return collapseRecallMatches(corroborated, {
    limit: RECALL_RESULT_POOL_LIMIT + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
}

function buildStrategyCaseResult(
  strategy: RetrievalAblationStrategy,
  rankedIdsAfterExclude: string[],
  rankedIdsBeforeExclude: string[],
  excludeDiagnostics: RetrievalAblationExcludeDiagnostics,
  expectedId: string,
  expectationKind: 'hit' | 'miss',
  missK = 10
): RetrievalAblationStrategyCaseResult {
  const rankedIds = rankedIdsAfterExclude
  const at1 = recallAtK(rankedIds, expectedId, 1)
  const at5 = recallAtK(rankedIds, expectedId, 5)
  const at10 = recallAtK(rankedIds, expectedId, 10)
  const goldInCandidates = rankedIds.includes(expectedId)
  let observedStage: RetrievalAblationStrategyCaseResult['observedStage']
  let summaryZh: string
  if (expectationKind === 'hit') {
    if (!goldInCandidates) {
      observedStage = 'candidate_miss'
      summaryZh = '目标未进入该策略候选列表（召回覆盖失败；根因未推断，不得直接归因 Embedding）'
    } else if (!at5.hit) {
      observedStage = 'in_pool_outside_top5'
      summaryZh = `目标在候选内但 rank=${String(at10.rank)}（>5，未进 Recall@5）；≠未进 Top1`
    } else {
      observedStage = 'not_applicable'
      summaryZh = at1.hit
        ? '目标已在 Recall@1'
        : `目标在 Recall@5 内但非 Top1（rank=${String(at10.rank)}）；计 inPoolNotTop1，不计 inPoolOutsideTop5`
    }
  } else {
    const kHit = recallAtK(rankedIds, expectedId, missK).hit
    if (kHit) {
      observedStage = 'expectation_failed'
      summaryZh = `负例禁止 id 不应进前 ${missK}，但被召回（误报）；根因未推断`
    } else {
      observedStage = 'absent_honest'
      summaryZh = `负例正确地未进入前 ${missK}`
    }
  }

  const negativeFalsePositive =
    expectationKind === 'miss' && recallAtK(rankedIds, expectedId, missK).hit
  const negativeFalsePositiveBeforeExclude =
    expectationKind === 'miss' && recallAtK(rankedIdsBeforeExclude, expectedId, missK).hit
  const excludePreventedFp =
    expectationKind === 'miss' && negativeFalsePositiveBeforeExclude && !negativeFalsePositive

  return {
    strategy,
    rankedIds,
    candidateCount: rankedIds.length,
    rankedIdsBeforeExclude,
    excludeDiagnostics,
    goldInCandidates,
    recallAt1: at1.hit,
    recallAt5: at5.hit,
    recallAt10: at10.hit,
    mrr: expectationKind === 'hit' ? mrrContribution(rankedIds, expectedId) : 0,
    ndcgAt5: expectationKind === 'hit' ? ndcgAtK(rankedIds, expectedId, 5) : 0,
    ndcgAt10: expectationKind === 'hit' ? ndcgAtK(rankedIds, expectedId, 10) : 0,
    rank: at10.rank,
    negativeFalsePositive,
    negativeFalsePositiveBeforeExclude,
    excludePreventedFp,
    observedStage,
    summaryZh
  }
}

/**
 * 跑一轮 L2 消融。
 * 无 embedClient 时仅可跑 keyword；否则抛错。
 */
export async function runRetrievalAblation(
  options: RunRetrievalAblationOptions = {}
): Promise<RetrievalAblationReport> {
  const nowMs = options.nowMs ?? RETRIEVAL_ABLATION_NOW_MS
  const cases = options.cases ?? RETRIEVAL_ABLATION_CASES
  const baseCorpus = options.corpus ?? buildRetrievalAblationCorpus()
  assertAblationCorpusHasNoEmbeddings(baseCorpus)

  const strategies = [...(options.strategies ?? (['keyword', 'semantic', 'hybrid'] as const))]
  const needsEmbed = strategies.some(item => item === 'semantic' || item === 'hybrid')
  let corpus = baseCorpus
  let embedModel: string | null = null
  const telemetry = createEmbedTelemetryCollector()

  if (needsEmbed) {
    const client = requireRealEmbedClient(options.embedClient, 'semantic')
    embedModel = client.model
    corpus = await embedCorpusItems(baseCorpus, client, telemetry)
  }

  const caseResults: RetrievalAblationCaseResult[] = []

  for (const ablationCase of cases) {
    const expectedId = ablationCase.expectation.expectedId
    const clueEmbeddingText =
      ablationCase.clueEmbeddingText?.trim() ||
      buildClueEmbeddingText({
        rawClue: ablationCase.clueForDisplay,
        parsed: ablationCase.goldParsed
      })

    let queryVector: number[] | null = null
    if (needsEmbed) {
      const client = requireRealEmbedClient(options.embedClient, 'semantic')
      const embedded = await callEmbedOrThrow(
        client,
        [clueEmbeddingText],
        telemetry,
        `clue:${ablationCase.id}`
      )
      queryVector = embedded[0]!
    }

    const byStrategy: RetrievalAblationCaseResult['byStrategy'] = {
      keyword: null,
      semantic: null,
      hybrid: null
    }

    for (const strategy of strategies) {
      let beforeAnyExclude: RecallMatch[]
      let enteringExit: RecallMatch[]
      if (strategy === 'keyword') {
        const pools = runKeywordStrategyPools(
          corpus,
          ablationCase.clueForDisplay,
          ablationCase.goldParsed,
          nowMs
        )
        beforeAnyExclude = pools.beforeAnyExclude
        enteringExit = pools.enteringExit
      } else if (strategy === 'semantic') {
        const matches = runSemanticStrategyMatches(corpus, ablationCase.goldParsed, queryVector!)
        beforeAnyExclude = matches
        enteringExit = matches
      } else {
        const matches = runHybridStrategyMatches(
          corpus,
          ablationCase.clueForDisplay,
          ablationCase.goldParsed,
          queryVector!
        )
        beforeAnyExclude = matches
        enteringExit = matches
      }
      const { matchesAfter, diagnostics } = applyAblationExcludeHardFilter(
        enteringExit,
        ablationCase.goldParsed.excludeContentTerms,
        beforeAnyExclude
      )
      const missK =
        ablationCase.expectation.kind === 'miss' ? (ablationCase.expectation.k ?? 10) : 10
      byStrategy[strategy] = buildStrategyCaseResult(
        strategy,
        rankedIdsFromMatches(matchesAfter),
        rankedIdsFromMatches(beforeAnyExclude),
        diagnostics,
        expectedId,
        ablationCase.expectation.kind,
        missK
      )
    }

    const missK =
      ablationCase.expectation.kind === 'miss' ? (ablationCase.expectation.k ?? 10) : null
    const fpFlags = strategies.map(strategy => byStrategy[strategy]?.negativeFalsePositive === true)
    const negativeStrategyDisagreement =
      ablationCase.expectation.kind === 'miss'
        ? fpFlags.includes(true) && fpFlags.includes(false)
        : null

    caseResults.push({
      caseId: ablationCase.id,
      gate: ablationCase.gate,
      scenario: ablationCase.scenario,
      labelConfidence: ablationCase.labelConfidence,
      goldReviewStatus: ablationCase.goldReviewStatus ?? 'stable',
      judgmentZh: ablationCase.judgmentZh,
      ...(ablationCase.labelAmbiguityZh ? { labelAmbiguityZh: ablationCase.labelAmbiguityZh } : {}),
      expectationKind: ablationCase.expectation.kind,
      expectedId,
      missK,
      goldParsed: ablationCase.goldParsed,
      clueEmbeddingText,
      byStrategy,
      negativeStrategyDisagreement
    })
  }

  const hitCases = caseResults.filter(item => item.expectationKind === 'hit')
  const negativeCases = caseResults.filter(item => item.expectationKind === 'miss')

  const buildDenominatorView = (
    mode: 'include' | 'clear_only',
    pool: readonly RetrievalAblationCaseResult[]
  ): RetrievalAblationDenominatorView => {
    const scoped =
      mode === 'include' ? [...pool] : pool.filter(item => item.labelConfidence === 'clear')
    const hits = scoped.filter(item => item.expectationKind === 'hit')
    const negs = scoped.filter(item => item.expectationKind === 'miss')
    const aggregateHitCases: RetrievalAblationDenominatorView['aggregateHitCases'] = {
      keyword: null,
      semantic: null,
      hybrid: null
    }
    const aggregateNegative: RetrievalAblationDenominatorView['aggregateNegative'] = {
      keyword: null,
      semantic: null,
      hybrid: null
    }
    for (const strategy of strategies) {
      const queries = hits.map(item => ({
        rankedIds: item.byStrategy[strategy]?.rankedIds ?? [],
        goldId: item.expectedId
      }))
      const r1 = meanRecallAtK(queries, 1)
      const r5 = meanRecallAtK(queries, 5)
      const r10 = meanRecallAtK(queries, 10)
      const mrr = meanMrr(queries)
      const ndcg5 = meanNdcgAtK(queries, 5)
      const ndcg10 = meanNdcgAtK(queries, 10)
      let candidateMissCount = 0
      let inPoolOutsideTop5Count = 0
      let inPoolNotTop1Count = 0
      let recallAt5HitCount = 0
      let top1Count = 0
      for (const item of hits) {
        const row = item.byStrategy[strategy]
        if (!row) {
          continue
        }
        const buckets = [
          row.observedStage === 'candidate_miss',
          row.observedStage === 'in_pool_outside_top5',
          row.goldInCandidates && row.recallAt5
        ]
        // 互斥：miss / >5 / ≤5 三者恰一
        if (buckets.filter(Boolean).length !== 1) {
          throw new Error(
            `[retrieval-ablation] 排名区间不互斥 case=${item.caseId} strategy=${strategy}`
          )
        }
        if (row.observedStage === 'candidate_miss') {
          candidateMissCount += 1
        } else if (row.observedStage === 'in_pool_outside_top5') {
          inPoolOutsideTop5Count += 1
        }
        if (row.goldInCandidates && !row.recallAt1 && row.recallAt5) {
          inPoolNotTop1Count += 1
        }
        if (row.recallAt1) {
          top1Count += 1
        }
        if (row.recallAt5) {
          recallAt5HitCount += 1
        }
      }
      if (candidateMissCount + inPoolOutsideTop5Count + recallAt5HitCount !== hits.length) {
        throw new Error(`[retrieval-ablation] 汇总不可复算 strategy=${strategy} mode=${mode}`)
      }
      if (top1Count + inPoolNotTop1Count !== recallAt5HitCount) {
        throw new Error(
          `[retrieval-ablation] Top1+inPoolNotTop1≠R@5ok strategy=${strategy} mode=${mode}`
        )
      }
      aggregateHitCases[strategy] = {
        recallAt1: r1.mean,
        recallAt5: r5.mean,
        recallAt10: r10.mean,
        mrr: mrr.mean,
        ndcgAt5: ndcg5.mean,
        ndcgAt10: ndcg10.mean,
        denominator: r1.denominator,
        candidateMissCount,
        inPoolOutsideTop5Count,
        inPoolNotTop1Count,
        recallAt5HitCount
      }
      aggregateNegative[strategy] = summarizeNegativeFalsePositives(
        negs.map(item => ({
          falsePositive: item.byStrategy[strategy]?.negativeFalsePositive === true
        }))
      )
    }
    return {
      mode,
      hitCaseCount: hits.length,
      negativeCaseCount: negs.length,
      ambiguousCaseCount: scoped.filter(item => item.labelConfidence === 'ambiguous').length,
      pendingReviewCaseCount: scoped.filter(item => item.goldReviewStatus === 'pending_review')
        .length,
      aggregateHitCases,
      aggregateNegative
    }
  }

  const denominatorViews = {
    include: buildDenominatorView('include', caseResults),
    clearOnly: buildDenominatorView('clear_only', caseResults)
  }
  const aggregateHitCases = denominatorViews.include.aggregateHitCases
  const aggregateNegative = denominatorViews.include.aggregateNegative

  const negativeCaseDetails: RetrievalAblationNegativeCaseDetail[] = negativeCases.map(item => {
    const ranksByStrategy: Record<RetrievalAblationStrategy, number | null> = {
      keyword: item.byStrategy.keyword?.rank ?? null,
      semantic: item.byStrategy.semantic?.rank ?? null,
      hybrid: item.byStrategy.hybrid?.rank ?? null
    }
    const falsePositiveByStrategy: Record<RetrievalAblationStrategy, boolean> = {
      keyword: false,
      semantic: false,
      hybrid: false
    }
    const falsePositiveBeforeExcludeByStrategy: Record<RetrievalAblationStrategy, boolean> = {
      keyword: false,
      semantic: false,
      hybrid: false
    }
    const excludePreventedFpByStrategy: Record<RetrievalAblationStrategy, boolean> = {
      keyword: false,
      semantic: false,
      hybrid: false
    }
    const flags: boolean[] = []
    for (const strategy of strategies) {
      const row = item.byStrategy[strategy]
      const fp = row?.negativeFalsePositive === true
      falsePositiveByStrategy[strategy] = fp
      falsePositiveBeforeExcludeByStrategy[strategy] =
        row?.negativeFalsePositiveBeforeExclude === true
      excludePreventedFpByStrategy[strategy] = row?.excludePreventedFp === true
      flags.push(fp)
    }
    const anyFalsePositive = flags.some(Boolean)
    const strategiesDisagree = flags.includes(true) && flags.includes(false)
    return {
      caseId: item.caseId,
      scenario: item.scenario,
      labelConfidence: item.labelConfidence,
      forbiddenId: item.expectedId,
      k: item.missK ?? 10,
      ranksByStrategy,
      falsePositiveByStrategy,
      falsePositiveBeforeExcludeByStrategy,
      excludePreventedFpByStrategy,
      strategiesDisagree,
      anyFalsePositive
    }
  })

  const scenarioCoverage: Partial<Record<RetrievalAblationScenario, number>> = {}
  for (const item of cases) {
    scenarioCoverage[item.scenario] = (scenarioCoverage[item.scenario] ?? 0) + 1
  }

  return {
    meta: {
      nowMs,
      corpusFingerprint: ablationCorpusFingerprint(baseCorpus),
      caseCount: cases.length,
      hitCaseCount: hitCases.length,
      negativeCaseCount: negativeCases.length,
      ambiguousLabelCaseCount: cases.filter(item => item.labelConfidence === 'ambiguous').length,
      scenarioCoverage,
      strategies,
      embedModel,
      embedTelemetry: needsEmbed ? telemetry.summarize() : null,
      missPolicy: 'include_miss_as_zero',
      ambiguousInDenominator: 'include',
      hybridVsProduction: { ...HYBRID_VS_PRODUCTION },
      knownDeltasZh: [...KNOWN_DELTAS_ZH]
    },
    cases: caseResults,
    aggregateHitCases,
    aggregateNegative,
    denominatorViews,
    negativeCaseDetails
  }
}

/** 控制台友好摘要。 */
export function formatRetrievalAblationSummary(report: RetrievalAblationReport): string {
  const lines: string[] = [
    `[retrieval-ablation] nowMs=${report.meta.nowMs} cases=${report.meta.caseCount} embed=${report.meta.embedModel ?? 'none'}`,
    `[retrieval-ablation] corpus=${report.meta.corpusFingerprint}`,
    `[retrieval-ablation] missPolicy=${report.meta.missPolicy}（hit 子集平均；负例用 negFP，不用 Recall@K）`
  ]
  lines.push(
    `[retrieval-ablation] hitCases=${report.meta.hitCaseCount} negativeCases=${report.meta.negativeCaseCount}` +
      ` ambiguousLabels=${report.meta.ambiguousLabelCaseCount}`
  )
  lines.push(`[retrieval-ablation] scenarios=${JSON.stringify(report.meta.scenarioCoverage)}`)
  lines.push(`[retrieval-ablation] hybridVsProd: ${report.meta.hybridVsProduction.noteZh}`)
  if (report.meta.embedTelemetry) {
    const t = report.meta.embedTelemetry
    lines.push(
      `[retrieval-ablation] embed ok=${t.okCount}/${t.callCount} texts=${t.totalTexts}` +
        ` models=${t.modelsSeen.join(',') || '∅'}` +
        ` p50Ms=${t.latencyMsP50 ?? 'n/a'} maxMs=${t.latencyMsMax ?? 'n/a'}` +
        (t.lastErrorCode ? ` lastErr=${t.lastErrorCode}` : '')
    )
  }
  const appendStrategyLines = (prefix: string, view: RetrievalAblationDenominatorView): void => {
    lines.push(
      `[retrieval-ablation] ${prefix} hits=${view.hitCaseCount} negs=${view.negativeCaseCount}` +
        ` ambiguousInView=${view.ambiguousCaseCount} pendingReview=${view.pendingReviewCaseCount}` +
        ` (denomMode=${view.mode})`
    )
    for (const strategy of report.meta.strategies) {
      const agg = view.aggregateHitCases[strategy]
      if (!agg) {
        lines.push(`[retrieval-ablation] ${prefix} ${strategy}: (未跑)`)
        continue
      }
      const neg = view.aggregateNegative[strategy]
      lines.push(
        `[retrieval-ablation] ${prefix} ${strategy} Recall@1/5/10=` +
          `${fmt(agg.recallAt1)}/${fmt(agg.recallAt5)}/${fmt(agg.recallAt10)}` +
          ` MRR=${fmt(agg.mrr)} nDCG@5/10=${fmt(agg.ndcgAt5)}/${fmt(agg.ndcgAt10)}` +
          ` denom=${agg.denominator}` +
          ` | candMiss=${agg.candidateMissCount}` +
          ` inPool>5=${agg.inPoolOutsideTop5Count}` +
          ` inPoolNotTop1=${agg.inPoolNotTop1Count}` +
          ` r5ok=${agg.recallAt5HitCount}` +
          (neg
            ? ` | negFP=${neg.falsePositiveCount}/${neg.caseCount} (${fmt(neg.falsePositiveRate)})`
            : '')
      )
    }
  }
  appendStrategyLines('main[include]', report.denominatorViews.include)
  appendStrategyLines('clear-only', report.denominatorViews.clearOnly)
  lines.push(
    '[retrieval-ablation] 禁止混用：主报告=include；clear-only 仅对照，分母与指标不得交叉引用'
  )
  for (const delta of report.meta.knownDeltasZh) {
    lines.push(`[retrieval-ablation] delta: ${delta}`)
  }
  lines.push('[retrieval-ablation] negative-details:')
  for (const detail of report.negativeCaseDetails) {
    if (!detail.anyFalsePositive && !detail.strategiesDisagree) {
      lines.push(
        `  - ${detail.caseId} OK forbid=${detail.forbiddenId}@${detail.k}` +
          (detail.labelConfidence === 'ambiguous' ? ' [ambiguous]' : '')
      )
      continue
    }
    lines.push(
      `  - ${detail.caseId} FP forbid=${detail.forbiddenId}@${detail.k}` +
        ` ranks={k:${detail.ranksByStrategy.keyword ?? '∅'},s:${detail.ranksByStrategy.semantic ?? '∅'},h:${detail.ranksByStrategy.hybrid ?? '∅'}}` +
        ` disagree=${detail.strategiesDisagree}` +
        (detail.labelConfidence === 'ambiguous' ? ' [ambiguous]' : '')
    )
  }
  lines.push('[retrieval-ablation] per-case:')
  for (const item of report.cases) {
    const parts = report.meta.strategies.map(strategy => {
      const row = item.byStrategy[strategy]
      if (!row) {
        return `${strategy}=n/a`
      }
      return `${strategy}:r=${row.rank ?? '∅'}@cand=${row.candidateCount}:${row.observedStage}`
    })
    lines.push(
      `  - ${item.caseId} [${item.scenario}/${item.labelConfidence}] (${item.expectationKind} ${item.expectedId}) | ${parts.join(' | ')}`
    )
  }
  return lines.join('\n')
}

function fmt(value: number | null): string {
  if (value === null) {
    return 'n/a'
  }
  return value.toFixed(3)
}
