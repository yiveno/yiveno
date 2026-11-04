/**
 * 批量探针结果聚合与排序（纯函数）。
 */

import type {
  ProbeBatchAggregates,
  ProbeBatchCaseResult,
  ProbeBatchGroupStats,
  ProbeBatchVerdict
} from './types'

function emptyGroup(): ProbeBatchGroupStats {
  return {
    total: 0,
    top1: 0,
    in_topk: 0,
    miss: 0,
    unmapped: 0,
    error: 0
  }
}

function bumpGroup(group: ProbeBatchGroupStats, verdict: ProbeBatchVerdict): void {
  group.total += 1
  switch (verdict) {
    case 'top1':
      group.top1 += 1
      break
    case 'in_topk':
      group.in_topk += 1
      break
    case 'miss':
      group.miss += 1
      break
    case 'unmapped':
      group.unmapped += 1
      break
    case 'error':
      group.error += 1
      break
  }
}

/** 线性插值分位数；空数组返回 0。 */
export function percentile(sortedAscending: readonly number[], p: number): number {
  if (sortedAscending.length === 0) {
    return 0
  }
  if (sortedAscending.length === 1) {
    return sortedAscending[0]!
  }
  const clamped = Math.min(1, Math.max(0, p))
  const index = (sortedAscending.length - 1) * clamped
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) {
    return sortedAscending[lo]!
  }
  const weight = index - lo
  return sortedAscending[lo]! * (1 - weight) + sortedAscending[hi]! * weight
}

const VERDICT_FAILURE_RANK: Record<ProbeBatchVerdict, number> = {
  error: 0,
  unmapped: 1,
  miss: 2,
  in_topk: 3,
  top1: 4
}

/** 失败（error / unmapped / miss）排前，同档按耗时降序。 */
export function sortProbeResultsFailuresFirst(
  rows: readonly ProbeBatchCaseResult[]
): ProbeBatchCaseResult[] {
  return [...rows].sort((a, b) => {
    const rankDelta = VERDICT_FAILURE_RANK[a.verdict] - VERDICT_FAILURE_RANK[b.verdict]
    if (rankDelta !== 0) {
      return rankDelta
    }
    return b.latencyMs - a.latencyMs
  })
}

/** 聚合逐条结果；返回的 cases 已失败优先排序。 */
export function aggregateProbeBatchResults(
  rows: readonly ProbeBatchCaseResult[]
): ProbeBatchAggregates & { cases: ProbeBatchCaseResult[] } {
  const byPersona: Record<string, ProbeBatchGroupStats> = {}
  const bySource: Record<string, ProbeBatchGroupStats> = {}
  let top1Count = 0
  let inTopkCount = 0
  let missCount = 0
  let unmappedCount = 0
  let errorCount = 0
  const latencies: number[] = []

  for (const row of rows) {
    latencies.push(row.latencyMs)
    const personaGroup = (byPersona[row.persona] ??= emptyGroup())
    const sourceGroup = (bySource[row.source] ??= emptyGroup())
    bumpGroup(personaGroup, row.verdict)
    bumpGroup(sourceGroup, row.verdict)

    switch (row.verdict) {
      case 'top1':
        top1Count += 1
        break
      case 'in_topk':
        inTopkCount += 1
        break
      case 'miss':
        missCount += 1
        break
      case 'unmapped':
        unmappedCount += 1
        break
      case 'error':
        errorCount += 1
        break
    }
  }

  const judged = top1Count + inTopkCount + missCount
  const sortedLatency = [...latencies].sort((a, b) => a - b)
  const cases = sortProbeResultsFailuresFirst(rows)

  return {
    cases,
    total: rows.length,
    judged,
    top1Count,
    inTopkCount,
    missCount,
    unmappedCount,
    errorCount,
    top1Rate: judged === 0 ? 0 : top1Count / judged,
    inTop3Rate: judged === 0 ? 0 : (top1Count + inTopkCount) / judged,
    missRate: judged === 0 ? 0 : missCount / judged,
    byPersona,
    bySource,
    latencyMs: {
      p50: percentile(sortedLatency, 0.5),
      p95: percentile(sortedLatency, 0.95)
    }
  }
}
