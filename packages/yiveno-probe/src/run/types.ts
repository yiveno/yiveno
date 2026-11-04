/**
 * 探针批量运行报告类型（纯数据；无 Chrome / IDB）。
 */

import type { ProbeVerifyVerdict } from '../verify/neighborhood'
import type { ProbeClueType, RecallProbePersonaId } from '../corpus/types'

/** 用例来源层。 */
export type ProbeBatchCaseSource = 'curated' | 'diversity' | 'cluster' | 'negative'

/** 判定扩展：邻域三态 + 映射缺失 + 运行异常 + 负例。 */
export type ProbeBatchVerdict =
  | ProbeVerifyVerdict
  | 'unmapped'
  | 'error'
  | 'false_positive' // 负例误报（有 topPick）
  | 'rejected' // 负例正确拒绝（topPick 为 null）

/** 展开后的单条跑分用例（尚未绑定 MemoryItem id）。 */
export type ProbeBatchCasePlan = {
  /** 稳定用例 id */
  caseId: string
  clue: string
  clueType: ProbeClueType
  /** 单条 expected key；集合/负例可空串 */
  expectedKey: string
  /** 集合 case：成员 keys */
  expectedKeys?: string[] | undefined
  preferredKey?: string | undefined
  clusterId?: string | undefined
  persona: RecallProbePersonaId
  source: ProbeBatchCaseSource
  kind: 'bookmark' | 'excerpt' | 'negative'
  label: string
  clueIndex: number
}

/** 单条运行结果。 */
export type ProbeBatchCaseResult = {
  caseId: string
  clue: string
  clueType: ProbeClueType
  expectedKey: string
  /** 映射缺失或负例时为 null */
  expectedId: string | null
  expectedIds?: string[] | undefined
  preferredId?: string | undefined
  clusterId?: string | undefined
  persona: RecallProbePersonaId
  source: ProbeBatchCaseSource
  kind: 'bookmark' | 'excerpt' | 'negative'
  label: string
  verdict: ProbeBatchVerdict
  actualTop1Title: string | null
  latencyMs: number
  error?: string | undefined
}

/** 分组计数。 */
export type ProbeBatchGroupStats = {
  total: number
  top1: number
  in_topk: number
  miss: number
  unmapped: number
  error: number
  false_positive: number
  rejected: number
}

/** 聚合指标。 */
export type ProbeBatchAggregates = {
  total: number
  /** 仅 top1/in_topk/miss */
  judged: number
  top1Count: number
  inTopkCount: number
  missCount: number
  unmappedCount: number
  errorCount: number
  top1Rate: number
  inTop3Rate: number
  missRate: number
  byPersona: Record<string, ProbeBatchGroupStats>
  bySource: Record<string, ProbeBatchGroupStats>
  /** M2；M1 历史记录可能缺省 */
  byClueType?: Record<string, ProbeBatchGroupStats> | undefined
  /** M2；M1 历史记录可能缺省 */
  clusters?:
    | {
        total: number
        anyHitCount: number
        preferredTop1Count: number
        anyHitRate: number
        preferredTop1Rate: number
      }
    | undefined
  /** M2；M1 历史记录可能缺省 */
  negatives?:
    | {
        total: number
        falsePositiveCount: number
        rejectedCount: number
        falsePositiveRate: number
      }
    | undefined
  latencyMs: {
    p50: number
    p95: number
  }
}

/** 一次完整批量运行报告。 */
export type ProbeBatchReport = {
  recipeId: string
  fillerSeed: number
  startedAtIso: string
  finishedAtIso: string
  cases: ProbeBatchCaseResult[]
  aggregates: ProbeBatchAggregates
}

/** 两次运行指标 diff 行。 */
export type ProbeRunDiffRow = {
  metric: string
  before: number
  after: number
  delta: number
}

export type ProbeRunDiff = {
  beforeRunId: string
  afterRunId: string
  rows: ProbeRunDiffRow[]
}
