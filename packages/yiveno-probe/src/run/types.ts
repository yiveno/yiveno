/**
 * 探针批量运行报告类型（纯数据；无 Chrome / IDB）。
 */

import type { ProbeVerifyVerdict } from '../verify/neighborhood'
import type { RecallProbePersonaId } from '../corpus/types'

/** 用例来源层。 */
export type ProbeBatchCaseSource = 'curated' | 'diversity'

/** 判定扩展：邻域三态 + 映射缺失 + 运行异常。 */
export type ProbeBatchVerdict = ProbeVerifyVerdict | 'unmapped' | 'error'

/** 展开后的单条跑分用例（尚未绑定 MemoryItem id）。 */
export type ProbeBatchCasePlan = {
  /** 稳定用例 id：`${expectedKey}#${clueIndex}` */
  caseId: string
  clue: string
  expectedKey: string
  persona: RecallProbePersonaId
  source: ProbeBatchCaseSource
  kind: 'bookmark' | 'excerpt'
  label: string
  clueIndex: number
}

/** 单条运行结果。 */
export type ProbeBatchCaseResult = {
  caseId: string
  clue: string
  expectedKey: string
  /** 映射缺失时为 null */
  expectedId: string | null
  persona: RecallProbePersonaId
  source: ProbeBatchCaseSource
  kind: 'bookmark' | 'excerpt'
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
}

/** 聚合指标。 */
export type ProbeBatchAggregates = {
  total: number
  /** 有 expectedId 且未抛错的判定条数 */
  judged: number
  top1Count: number
  inTopkCount: number
  missCount: number
  unmappedCount: number
  errorCount: number
  /** top1 / judged；judged=0 时为 0 */
  top1Rate: number
  /** (top1+in_topk) / judged */
  inTop3Rate: number
  missRate: number
  byPersona: Record<string, ProbeBatchGroupStats>
  bySource: Record<string, ProbeBatchGroupStats>
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
