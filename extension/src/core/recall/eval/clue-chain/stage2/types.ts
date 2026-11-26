/**
 * 合成 Clue 闭环 · Stage 2 召回评测类型（仅 harness）。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { BehaviorSeedRow, ClueGenItemView } from '@/core/recall/eval/behavior-ablation/types'
import type { RecallEvalClueClass } from '@/core/recall/eval/recall-eval-cases'

/** 正例档位（与 recall-eval clueClass 对齐，不含 negative）。 */
export type Stage2PositiveTier = Exclude<RecallEvalClueClass, 'negative'>

/** 任务档位：三档正例 + 负例。 */
export type Stage2ClueTier = RecallEvalClueClass

/**
 * 失败归因阶段（解析 / 过滤 / 排序分开）。
 * - parse：规则解析无可用 terms，或目标区分词未进入解析面（信号在 parse 丢）
 * - filtered：有解析信号，但目标未进最终邻域（硬筛 / 池外）
 * - rank：目标在邻域内但位次靠后
 * - false_hit：负例却给出 Top Pick
 * - ok：达期望（正例进邻域按指标另计；负例无命中）
 * - error：harness / fuse 抛错
 */
export type Stage2FailStage = 'parse' | 'filtered' | 'rank' | 'false_hit' | 'ok' | 'error'

/** 单条 Stage 2 任务。 */
export interface Stage2Task {
  id: string
  /** concrete / semi_fuzzy / vague / negative */
  tier: Stage2ClueTier
  clue: string
  /**
   * 真目标 id；negative 为 null。
   */
  targetId: string | null
  /** 主题簇（正例来自目标；负例为 synthetic 标签） */
  clusterId: string
  /** fake embed 查询锚（正例对齐目标；负例用正交锚） */
  embeddingAnchor: string
  /** 中文说明：为何这样出题 */
  note: string
}

export interface Stage2DatasetMeta {
  version: number
  seed: number
  nowMs: number
  nowIso: string
  corpusItems: number
  topicClusters: number
  positiveTasks: number
  negativeTasks: number
  totalTasks: number
}

export interface Stage2Dataset {
  meta: Stage2DatasetMeta
  corpus: MemoryItem[]
  behavior: BehaviorSeedRow[]
  clueViews: ClueGenItemView[]
  tasks: Stage2Task[]
}

/** 单条跑案结果。 */
export interface Stage2CaseResult {
  taskId: string
  tier: Stage2ClueTier
  clusterId: string
  clue: string
  targetId: string | null
  rankedIds: string[]
  top3: string[]
  /** 1-based；负例或未命中为 null */
  rank: number | null
  /** 解析得到的 contentTerms */
  contentTerms: string[]
  /** 归因阶段 */
  stage: Stage2FailStage
  /** 短中文说明 */
  detail: string
  durationMs: number
  error: string | null
}

export interface Stage2MetricBlock {
  n: number
  recallAt1: number
  recallAt3: number
  recallAt5: number
  mrr: number
  /** 命中者平均排名；全 miss 时 null */
  meanRank: number | null
  missRate: number
}

export interface Stage2ReportSummary {
  totalTasks: number
  positiveTasks: number
  negativeTasks: number
  /** 正例聚合 */
  positive: Stage2MetricBlock
  /** 负例误命中率（有 Top1 / 邻域非空） */
  negativeFalseHitRate: number
  negativeFalseHits: number
  /** 按档位 */
  byTier: Record<Stage2ClueTier, Stage2MetricBlock | { n: number; falseHitRate: number }>
  /** 按主题簇（仅正例） */
  byCluster: Record<string, Stage2MetricBlock>
  /** 归因阶段计数 */
  stageCounts: Record<Stage2FailStage, number>
}

export interface Stage2FailureCluster {
  key: string
  stage: Stage2FailStage
  tier: Stage2ClueTier
  count: number
  ids: string[]
}

export interface Stage2WorstCase {
  taskId: string
  tier: Stage2ClueTier
  clue: string
  targetId: string | null
  top3: string[]
  rank: number | null
  stage: Stage2FailStage
  detail: string
}

export interface Stage2Report {
  schemaVersion: 1
  kind: 'clue-chain-stage2-recall'
  head: string
  startedAt: string
  finishedAt: string
  seed: number
  nowMs: number
  track: {
    parse: 'rules'
    embedding: 'fake'
    llm: false
  }
  summary: Stage2ReportSummary
  /** 建议门禁（首轮提议；未锁死） */
  suggestedGates: {
    positiveRecallAt1Min: number
    positiveRecallAt5Min: number
    positiveMrrMin: number
    concreteRecallAt1Min: number
    negativeFalseHitMax: number
  }
  /** 相对建议门禁的观测（仅汇报） */
  suggestedGateObservations: Array<{
    id: string
    observed: number
    threshold: number
    passed: boolean
    detail: string
  }>
  clusters: Stage2FailureCluster[]
  worst20: Stage2WorstCase[]
  cases: Stage2CaseResult[]
}

export interface Stage2BaselineDelta {
  baselinePath: string
  baselineHead: string
  currentHead: string
  recallAt1Delta: number
  recallAt5Delta: number
  mrrDelta: number
  negativeFalseHitDelta: number
  newlyWorseIds: string[]
  newlyBetterIds: string[]
  degraded: boolean
}
