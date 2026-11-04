/**
 * 两次探针运行聚合指标 diff（纯函数）。
 */

import type { ProbeBatchAggregates, ProbeRunDiff, ProbeRunDiffRow } from './types'

function pushRate(rows: ProbeRunDiffRow[], metric: string, before: number, after: number): void {
  rows.push({
    metric,
    before,
    after,
    delta: after - before
  })
}

/**
 * 对比两次聚合指标（率与计数 + 延迟）。
 * before / after 对应较早 / 较晚一次运行的语义由调用方决定。
 */
export function diffProbeBatchAggregates(input: {
  beforeRunId: string
  afterRunId: string
  before: ProbeBatchAggregates
  after: ProbeBatchAggregates
}): ProbeRunDiff {
  const rows: ProbeRunDiffRow[] = []
  pushRate(rows, 'top1Rate', input.before.top1Rate, input.after.top1Rate)
  pushRate(rows, 'inTop3Rate', input.before.inTop3Rate, input.after.inTop3Rate)
  pushRate(rows, 'missRate', input.before.missRate, input.after.missRate)
  pushRate(rows, 'total', input.before.total, input.after.total)
  pushRate(rows, 'judged', input.before.judged, input.after.judged)
  pushRate(rows, 'unmappedCount', input.before.unmappedCount, input.after.unmappedCount)
  pushRate(rows, 'errorCount', input.before.errorCount, input.after.errorCount)
  pushRate(rows, 'latencyMs.p50', input.before.latencyMs.p50, input.after.latencyMs.p50)
  pushRate(rows, 'latencyMs.p95', input.before.latencyMs.p95, input.after.latencyMs.p95)
  return {
    beforeRunId: input.beforeRunId,
    afterRunId: input.afterRunId,
    rows
  }
}
