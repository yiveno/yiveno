/**
 * 探针批量运行：用例展开、聚合、diff（纯函数面）。
 */

export { aggregateProbeBatchResults, percentile, sortProbeResultsFailuresFirst } from './aggregate'
export { buildProbeBatchCasePlan, splitCountAcrossPersonas } from './case-plan'
export type { BuildProbeBatchCasePlanInput } from './case-plan'
export { diffProbeBatchAggregates } from './diff'
export type {
  ProbeBatchAggregates,
  ProbeBatchCasePlan,
  ProbeBatchCaseResult,
  ProbeBatchCaseSource,
  ProbeBatchGroupStats,
  ProbeBatchReport,
  ProbeBatchVerdict,
  ProbeRunDiff,
  ProbeRunDiffRow
} from './types'
