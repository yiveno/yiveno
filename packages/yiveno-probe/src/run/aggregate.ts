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
    error: 0,
    false_positive: 0,
    rejected: 0
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
    case 'false_positive':
      group.false_positive += 1
      break
    case 'rejected':
      group.rejected += 1
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

/** 失败优先：error < unmapped < false_positive < miss < in_topk < top1 < rejected */
const VERDICT_FAILURE_RANK: Record<ProbeBatchVerdict, number> = {
  error: 0,
  unmapped: 1,
  false_positive: 2,
  miss: 3,
  in_topk: 4,
  top1: 5,
  rejected: 6
}

/** 失败排前，同档按耗时降序。 */
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
  const byClueType: Record<string, ProbeBatchGroupStats> = {}
  let top1Count = 0
  let inTopkCount = 0
  let missCount = 0
  let unmappedCount = 0
  let errorCount = 0
  let clusterTotal = 0
  let clusterAnyHit = 0
  let clusterPreferredTop1 = 0
  let negativeTotal = 0
  let negativeFp = 0
  let negativeRejected = 0
  const latencies: number[] = []

  for (const row of rows) {
    latencies.push(row.latencyMs)
    bumpGroup((byPersona[row.persona] ??= emptyGroup()), row.verdict)
    bumpGroup((bySource[row.source] ??= emptyGroup()), row.verdict)
    // 负例不计入 byClueType（占位 clueType 仅展示；避免污染类型 top1 率）
    if (row.source !== 'negative') {
      bumpGroup((byClueType[row.clueType] ??= emptyGroup()), row.verdict)
    }

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
      default:
        break
    }

    if (row.source === 'cluster' && row.expectedIds !== undefined) {
      clusterTotal += 1
      if (row.verdict === 'top1') {
        clusterPreferredTop1 += 1
        clusterAnyHit += 1
      } else if (row.verdict === 'in_topk') {
        clusterAnyHit += 1
      }
    }

    if (row.source === 'negative') {
      negativeTotal += 1
      if (row.verdict === 'false_positive') {
        negativeFp += 1
      } else if (row.verdict === 'rejected') {
        negativeRejected += 1
      }
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
    byClueType,
    clusters: {
      total: clusterTotal,
      anyHitCount: clusterAnyHit,
      preferredTop1Count: clusterPreferredTop1,
      anyHitRate: clusterTotal === 0 ? 0 : clusterAnyHit / clusterTotal,
      preferredTop1Rate: clusterTotal === 0 ? 0 : clusterPreferredTop1 / clusterTotal
    },
    negatives: {
      total: negativeTotal,
      falsePositiveCount: negativeFp,
      rejectedCount: negativeRejected,
      falsePositiveRate: negativeTotal === 0 ? 0 : negativeFp / negativeTotal
    },
    latencyMs: {
      p50: percentile(sortedLatency, 0.5),
      p95: percentile(sortedLatency, 0.95)
    }
  }
}
