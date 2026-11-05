/**
 * L2 真实消融 · 相对基线快照的质量门禁（纯函数 · 不接生产路径）。
 *
 * 口径：主报告 `denominatorViews.include`；召回/MRR/nDCG 不得低于基线（ε）；
 * negFP 率不得高于基线（ε）。只防退步，不逼进步。
 */

import type {
  RetrievalAblationHitAggregate,
  RetrievalAblationReport,
  RetrievalAblationStrategy
} from '@/core/recall/eval/run-retrieval-ablation'

/** 浮点比较容差（11 题一档约 0.09，ε 远小于一档）。 */
export const RETRIEVAL_ABLATION_METRIC_EPSILON = 1e-6

/** 消融门禁指标方向：越高越好 / 越低越好。 */
export type AblationGatedMetricKind =
  | 'higher_better' // 召回 / MRR / nDCG 等
  | 'lower_better' // 负例误报率等

export type AblationGatedMetricId =
  | `${RetrievalAblationStrategy}.recallAt1`
  | `${RetrievalAblationStrategy}.recallAt5`
  | `${RetrievalAblationStrategy}.mrr`
  | `${RetrievalAblationStrategy}.ndcgAt5`
  | `${RetrievalAblationStrategy}.negFpRate`

export type AblationMetricSample = {
  id: AblationGatedMetricId
  kind: AblationGatedMetricKind
  baseline: number
  current: number
}

export type AblationBaselineCompareResult = {
  degraded: AblationMetricSample[]
  improved: AblationMetricSample[]
  unchanged: AblationMetricSample[]
  /** degraded 为空则 true */
  passed: boolean
}

const STRATEGIES: RetrievalAblationStrategy[] = ['keyword', 'semantic', 'hybrid']

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`消融基线缺少对象：${label}`)
  }
  return value as Record<string, unknown>
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`消融基线字段非有限数：${label}`)
  }
  return value
}

function readHitMetric(
  agg: RetrievalAblationHitAggregate | null | undefined,
  key: keyof Pick<RetrievalAblationHitAggregate, 'recallAt1' | 'recallAt5' | 'mrr' | 'ndcgAt5'>,
  label: string
): number {
  if (!agg) {
    throw new Error(`消融基线缺少 hit 聚合：${label}`)
  }
  const raw = agg[key]
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error(`消融基线 hit 指标无效：${label}.${key}`)
  }
  return raw
}

/**
 * 从 real-run 外包 JSON（含 `report`）或裸 `RetrievalAblationReport` 抽出报告。
 */
export function extractRetrievalAblationReport(raw: unknown): RetrievalAblationReport {
  const root = asRecord(raw, 'root')
  if ('report' in root) {
    return asRecord(root.report, 'report') as unknown as RetrievalAblationReport
  }
  if ('denominatorViews' in root && 'meta' in root) {
    return root as unknown as RetrievalAblationReport
  }
  throw new Error('消融基线须为 real-run 外包 JSON（含 report）或裸 RetrievalAblationReport')
}

/** 抽出门禁用的 include 主口径指标。 */
export function extractAblationGatedMetrics(
  report: RetrievalAblationReport
): Record<AblationGatedMetricId, number> {
  const include = report.denominatorViews?.include
  if (!include) {
    throw new Error('消融报告缺少 denominatorViews.include')
  }
  const out = {} as Record<AblationGatedMetricId, number>
  for (const strategy of STRATEGIES) {
    const hit = include.aggregateHitCases[strategy]
    const neg = include.aggregateNegative[strategy]
    out[`${strategy}.recallAt1`] = readHitMetric(hit, 'recallAt1', strategy)
    out[`${strategy}.recallAt5`] = readHitMetric(hit, 'recallAt5', strategy)
    out[`${strategy}.mrr`] = readHitMetric(hit, 'mrr', strategy)
    out[`${strategy}.ndcgAt5`] = readHitMetric(hit, 'ndcgAt5', strategy)
    if (!neg || neg.falsePositiveRate === null || typeof neg.falsePositiveRate !== 'number') {
      throw new Error(`消融报告缺少 negFP：${strategy}`)
    }
    out[`${strategy}.negFpRate`] = asNumber(neg.falsePositiveRate, `${strategy}.negFpRate`)
  }
  return out
}

function metricKind(id: AblationGatedMetricId): AblationGatedMetricKind {
  return id.endsWith('.negFpRate') ? 'lower_better' : 'higher_better'
}

/**
 * 对照基线：召回类不得降、negFP 不得升（超过 ε 即计退化）。
 */
export function compareRetrievalAblationToBaseline(input: {
  current: RetrievalAblationReport
  baseline: RetrievalAblationReport
  epsilon?: number
}): AblationBaselineCompareResult {
  const epsilon = input.epsilon ?? RETRIEVAL_ABLATION_METRIC_EPSILON
  const baselineMetrics = extractAblationGatedMetrics(input.baseline)
  const currentMetrics = extractAblationGatedMetrics(input.current)

  const degraded: AblationMetricSample[] = []
  const improved: AblationMetricSample[] = []
  const unchanged: AblationMetricSample[] = []

  for (const id of Object.keys(baselineMetrics) as AblationGatedMetricId[]) {
    const baseline = baselineMetrics[id]
    const current = currentMetrics[id]
    if (typeof current !== 'number') {
      throw new Error(`本次消融缺少指标：${id}`)
    }
    const kind = metricKind(id)
    const sample: AblationMetricSample = { id, kind, baseline, current }
    const delta = current - baseline
    if (kind === 'higher_better') {
      if (delta < -epsilon) {
        degraded.push(sample)
      } else if (delta > epsilon) {
        improved.push(sample)
      } else {
        unchanged.push(sample)
      }
    } else if (delta > epsilon) {
      degraded.push(sample)
    } else if (delta < -epsilon) {
      improved.push(sample)
    } else {
      unchanged.push(sample)
    }
  }

  return {
    degraded,
    improved,
    unchanged,
    passed: degraded.length === 0
  }
}

export function formatRetrievalAblationBaselineCompareSummary(
  result: AblationBaselineCompareResult,
  opts?: { baselinePath?: string }
): string {
  const pathNote = opts?.baselinePath ? ` path=${opts.baselinePath}` : ''
  const fmt = (sample: AblationMetricSample): string =>
    `${sample.id}: ${sample.baseline.toFixed(3)}→${sample.current.toFixed(3)}`
  const lines = [
    `[retrieval-ablation:real] vs baseline${pathNote}`,
    `  degraded: ${result.degraded.length ? result.degraded.map(fmt).join('; ') : '(none)'}`,
    `  improved: ${result.improved.length ? result.improved.map(fmt).join('; ') : '(none)'}`,
    `  unchanged: ${result.unchanged.length}`,
    `  gate: ${result.passed ? 'PASS (no metric regression)' : 'FAIL (quality below baseline)'}`
  ]
  return lines.join('\n')
}
