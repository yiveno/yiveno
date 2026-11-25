/**
 * 行为层消融 · 数据集 / 任务 / 臂 / 报告类型（仅 harness）。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/** 生产轨四臂。 */
export type ProdArmId = 'OFF' | 'ON-prod' | 'ON-beh' | 'ON-cond'

/** 机制轨两臂。 */
export type MechArmId = 'B-on' | 'B-off'

/** clue 生成侧可见的条目视图——刻意不含行为字段。 */
export interface ClueGenItemView {
  id: string
  type: 'bookmark' | 'text_excerpt'
  clusterId: string
  /** 簇共享词（近邻干扰用） */
  sharedTerms: readonly string[]
  /** 本条独特区分词 */
  distinctiveTerms: readonly string[]
  title: string
  url: string
  domain: string
  note: string
  tags: readonly string[]
  keywords: readonly string[]
  /** 摘录正文；bookmark 可空 */
  selectedText: string
  /** fake embedding 对齐锚 */
  embeddingAnchor: string
  createdAt: string
}

/** 行为播种记录（与 clue 解耦；按 itemId）。 */
export interface BehaviorSeedRow {
  itemId: string
  openCount: number
  settledCount: number
  dismissCount: number
  lastOpenedAt: string | null
  /** 潜在常用度抽样原值（可审计） */
  popularityDraw: number
}

/** 主任务 / 冲突任务共用字段。 */
export interface BehaviorAblationTaskBase {
  id: string
  track: 'prod_main' | 'prod_conflict' | 'mech_conflict'
  /** paraphrase | partial | wrong_detail | conflict */
  kind: 'paraphrase' | 'partial' | 'wrong_detail' | 'conflict'
  clue: string
  /** 真目标 */
  targetId: string
  /** 干扰项（冲突子集必填） */
  distractorId?: string
  /** clue 侧用于 fake embed 对齐目标的锚（不含行为） */
  embeddingAnchor: string
  /** 陈述侧指向的词（冲突：常指向 distractor） */
  statementPullTerms: readonly string[]
  /** 其余细节指向目标的词 */
  targetPullTerms: readonly string[]
}

/** 机制轨冲突额外：显式注入条件的词面。 */
export interface MechConflictTask extends BehaviorAblationTaskBase {
  track: 'mech_conflict'
  /** 陈述条件值（指向 distractor） */
  statementConditionValue: string
  /** 行为条件值（指向 target） */
  behaviorConditionValue: string
  /** 条件槽：机制轨用 contentTerm 权重差测「行为压陈述」 */
  conditionSlot: 'contentTerm'
}

export type BehaviorAblationTask = BehaviorAblationTaskBase | MechConflictTask

export interface BehaviorAblationDatasetMeta {
  version: number
  seed: number
  nowMs: number
  nowIso: string
  corpusItems: number
  topicClusters: number
  mainTasks: number
  conflictProd: number
  conflictMech: number
}

export interface BehaviorAblationDataset {
  meta: BehaviorAblationDatasetMeta
  /** 已播种行为的完整语料 */
  corpus: MemoryItem[]
  behavior: BehaviorSeedRow[]
  /** clue 生成视图（无行为字段；测试断言） */
  clueViews: ClueGenItemView[]
  mainTasks: BehaviorAblationTaskBase[]
  conflictProdTasks: BehaviorAblationTaskBase[]
  conflictMechTasks: MechConflictTask[]
}

/** 单条 × 单臂排名结果。 */
export interface ArmCaseResult {
  taskId: string
  arm: ProdArmId | MechArmId
  targetId: string
  rankedIds: string[]
  rank: number | null
  candidateNonEmpty: boolean
  /** 候选非空且 Top1 ≠ 目标 → 误打开（语音现行逻辑） */
  falseOpen: boolean
  top1Id: string | null
}

export interface ArmMetrics {
  arm: ProdArmId | MechArmId
  n: number
  recallAt1: number
  recallAt3: number
  recallAt5: number
  mrr: number
  /** 命中者平均排名；全 miss 时 null */
  meanRank: number | null
  missRate: number
  falseOpenRate: number
  candidateNonEmptyRate: number
}

export interface DeltaCi {
  delta: number
  ci95Lower: number
  ci95Upper: number
}

export interface GateVerdict {
  id: 'prod_r1' | 'prod_mrr' | 'prod_false_open' | 'mech_r1'
  passed: boolean
  /** 实际数值（陈述用） */
  observed: number
  threshold: number
  detail: string
}

export interface BehaviorAblationRunReport {
  meta: {
    seed: number
    bootstrapSeed: number
    nowMs: number
    datasetVersion: number
    runAtIso: string
    reproducibility: { runAHash: string; runBHash: string; identical: boolean }
    llmArm: 'skipped' | 'ran'
    llmArmNote: string
  }
  prod: {
    arms: Record<ProdArmId, ArmMetrics>
    deltas: {
      onProdMinusOff: { r1: DeltaCi; mrr: DeltaCi; falseOpen: DeltaCi }
      mcnemarR1: { b: number; c: number; chi2: number; pApprox: number }
    }
    worstRankDeltas: Array<{
      taskId: string
      offRank: number | null
      onProdRank: number | null
      delta: number
    }>
  }
  mech: {
    arms: Record<MechArmId, ArmMetrics>
    deltas: { bOnMinusBOff: { r1: DeltaCi } }
  }
  gates: GateVerdict[]
  gatesAllPassed: boolean
  cases: ArmCaseResult[]
}
