/**
 * Stage 2 基线对比：R@1 / R@5 / MRR / 负例误命中 delta。
 */

import type {
  Stage2BaselineDelta,
  Stage2CaseResult,
  Stage2Report
} from '@/core/recall/eval/clue-chain/stage2/types'

function asReport(raw: unknown): Stage2Report {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('stage2 基线不是对象')
  }
  const report = raw as Stage2Report
  if (report.kind !== 'clue-chain-stage2-recall' || report.schemaVersion !== 1) {
    throw new Error('stage2 基线 kind/schemaVersion 不匹配')
  }
  return report
}

/** 正例「邻域命中质量」：R@5 hit 且 rank 更小更好；用 rank 或缺席作比较键。 */
function qualityKey(row: Stage2CaseResult): number {
  if (row.tier === 'negative') {
    // 负例：无命中最好 → 0；有命中差 → 1
    return row.rankedIds.length > 0 ? 1 : 0
  }
  if (row.rank == null) return 999
  return row.rank
}

/** 对比当前报告与基线。 */
export function compareStage2Baseline(
  current: Stage2Report,
  baselineRaw: unknown,
  baselinePath: string
): Stage2BaselineDelta {
  const baseline = asReport(baselineRaw)
  const baselineById = new Map(baseline.cases.map(row => [row.taskId, row]))
  const currentById = new Map(current.cases.map(row => [row.taskId, row]))

  const newlyWorseIds: string[] = []
  const newlyBetterIds: string[] = []

  for (const [id, baseRow] of baselineById) {
    const cur = currentById.get(id)
    if (!cur) continue
    const baseQ = qualityKey(baseRow)
    const curQ = qualityKey(cur)
    if (curQ > baseQ + 1e-9) newlyWorseIds.push(id)
    if (curQ + 1e-9 < baseQ) newlyBetterIds.push(id)
  }
  newlyWorseIds.sort()
  newlyBetterIds.sort()

  const recallAt1Delta = current.summary.positive.recallAt1 - baseline.summary.positive.recallAt1
  const recallAt5Delta = current.summary.positive.recallAt5 - baseline.summary.positive.recallAt5
  const mrrDelta = current.summary.positive.mrr - baseline.summary.positive.mrr
  const negativeFalseHitDelta =
    current.summary.negativeFalseHitRate - baseline.summary.negativeFalseHitRate

  const degraded =
    newlyWorseIds.length > 0 ||
    recallAt1Delta < -1e-9 ||
    recallAt5Delta < -1e-9 ||
    mrrDelta < -1e-9 ||
    negativeFalseHitDelta > 1e-9

  return {
    baselinePath,
    baselineHead: baseline.head,
    currentHead: current.head,
    recallAt1Delta,
    recallAt5Delta,
    mrrDelta,
    negativeFalseHitDelta,
    newlyWorseIds,
    newlyBetterIds,
    degraded
  }
}

export function formatStage2BaselineDelta(delta: Stage2BaselineDelta): string {
  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}pp`
  const lines = [
    `vs baseline ${delta.baselinePath}`,
    `  R@1 ${fmt(delta.recallAt1Delta)} · R@5 ${fmt(delta.recallAt5Delta)} · MRR ${fmt(delta.mrrDelta)} · negFH ${fmt(delta.negativeFalseHitDelta)}`,
    `  worse=${delta.newlyWorseIds.length} better=${delta.newlyBetterIds.length} degraded=${delta.degraded}`
  ]
  if (delta.newlyWorseIds.length > 0) {
    lines.push(`  newlyWorse: ${delta.newlyWorseIds.slice(0, 12).join(', ')}`)
  }
  return lines.join('\n')
}
