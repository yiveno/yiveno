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

/** clueType 行：与主指标对齐，分母 = judged（top1+in_topk+miss）；为 0 则跳过。 */
function groupJudgedTop1Rate(
  group: { top1: number; in_topk: number; miss: number } | undefined
): number | null {
  if (!group) {
    return null
  }
  const judged = group.top1 + group.in_topk + group.miss
  if (judged === 0) {
    return null
  }
  return group.top1 / judged
}

/**
 * 对比两次聚合指标。
 * 兼容 M1 记录：任一侧缺 byClueType/clusters/negatives 时跳过对应行。
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

  const beforeTypes = input.before.byClueType ?? {}
  const afterTypes = input.after.byClueType ?? {}
  const typeKeys = new Set([...Object.keys(beforeTypes), ...Object.keys(afterTypes)])
  for (const type of [...typeKeys].sort()) {
    const beforeRate = groupJudgedTop1Rate(beforeTypes[type])
    const afterRate = groupJudgedTop1Rate(afterTypes[type])
    if (beforeRate === null || afterRate === null) {
      continue
    }
    pushRate(rows, `clueType.${type}.top1Rate`, beforeRate, afterRate)
  }

  if (input.before.clusters && input.after.clusters) {
    pushRate(
      rows,
      'clusters.anyHitRate',
      input.before.clusters.anyHitRate,
      input.after.clusters.anyHitRate
    )
    pushRate(
      rows,
      'clusters.preferredTop1Rate',
      input.before.clusters.preferredTop1Rate,
      input.after.clusters.preferredTop1Rate
    )
  }

  if (input.before.negatives && input.after.negatives) {
    pushRate(
      rows,
      'negatives.falsePositiveRate',
      input.before.negatives.falsePositiveRate,
      input.after.negatives.falsePositiveRate
    )
  }

  return {
    beforeRunId: input.beforeRunId,
    afterRunId: input.afterRunId,
    rows
  }
}
