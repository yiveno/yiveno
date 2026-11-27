/**
 * 臂级指标：Recall@1/3/5、MRR、平均排名、未召回率、误打开率。
 */

import { meanMrr, meanRecallAtK, rankOfGold } from '../metrics'
import type { ArmCaseResult, ArmMetrics, MechArmId, ProdArmId } from './types'

export function computeArmMetrics(
  arm: ProdArmId | MechArmId,
  cases: readonly ArmCaseResult[]
): ArmMetrics {
  const forArm = cases.filter(row => row.arm === arm)
  const queries = forArm.map(row => ({
    rankedIds: row.rankedIds,
    goldId: row.targetId
  }))

  const r1 = meanRecallAtK(queries, 1)
  const r3 = meanRecallAtK(queries, 3)
  const r5 = meanRecallAtK(queries, 5)
  const mrr = meanMrr(queries)

  let rankSum = 0
  let rankN = 0
  let miss = 0
  let falseOpen = 0
  let nonEmpty = 0
  for (const row of forArm) {
    if (row.candidateNonEmpty) {
      nonEmpty += 1
    }
    if (row.falseOpen) {
      falseOpen += 1
    }
    const rank = rankOfGold(row.rankedIds, row.targetId)
    if (rank === null) {
      miss += 1
    } else {
      rankSum += rank
      rankN += 1
    }
  }

  const n = forArm.length
  return {
    arm,
    n,
    recallAt1: r1.mean ?? 0,
    recallAt3: r3.mean ?? 0,
    recallAt5: r5.mean ?? 0,
    mrr: mrr.mean ?? 0,
    meanRank: rankN === 0 ? null : rankSum / rankN,
    missRate: n === 0 ? 0 : miss / n,
    falseOpenRate: n === 0 ? 0 : falseOpen / n,
    candidateNonEmptyRate: n === 0 ? 0 : nonEmpty / n
  }
}

/** 任务级配对：同 taskId 的两臂 hit@1（0/1）。 */
export function pairedR1Hits(
  cases: readonly ArmCaseResult[],
  armA: ProdArmId | MechArmId,
  armB: ProdArmId | MechArmId
): Array<{ taskId: string; a: 0 | 1; b: 0 | 1 }> {
  const byTask = new Map<string, { a?: 0 | 1; b?: 0 | 1 }>()
  for (const row of cases) {
    if (row.arm !== armA && row.arm !== armB) continue
    const slot = byTask.get(row.taskId) ?? {}
    const hit: 0 | 1 = row.rank !== null && row.rank <= 1 ? 1 : 0
    if (row.arm === armA) slot.a = hit
    else slot.b = hit
    byTask.set(row.taskId, slot)
  }
  const out: Array<{ taskId: string; a: 0 | 1; b: 0 | 1 }> = []
  for (const [taskId, slot] of byTask) {
    if (slot.a === undefined || slot.b === undefined) continue
    out.push({ taskId, a: slot.a, b: slot.b })
  }
  out.sort((left, right) => left.taskId.localeCompare(right.taskId))
  return out
}

/** 任务级配对连续值（MRR 贡献 / falseOpen 0|1）。 */
export function pairedScalar(
  cases: readonly ArmCaseResult[],
  armA: ProdArmId | MechArmId,
  armB: ProdArmId | MechArmId,
  pick: (row: ArmCaseResult) => number
): Array<{ taskId: string; a: number; b: number }> {
  const byTask = new Map<string, { a?: number; b?: number }>()
  for (const row of cases) {
    if (row.arm !== armA && row.arm !== armB) continue
    const slot = byTask.get(row.taskId) ?? {}
    const value = pick(row)
    if (row.arm === armA) slot.a = value
    else slot.b = value
    byTask.set(row.taskId, slot)
  }
  const out: Array<{ taskId: string; a: number; b: number }> = []
  for (const [taskId, slot] of byTask) {
    if (slot.a === undefined || slot.b === undefined) continue
    out.push({ taskId, a: slot.a, b: slot.b })
  }
  out.sort((left, right) => left.taskId.localeCompare(right.taskId))
  return out
}

/** ON-prod vs OFF 排名变化最大的 10 条（|delta|；miss 记为 pool+1）。 */
export function topRankDeltas(
  cases: readonly ArmCaseResult[],
  offArm: ProdArmId | MechArmId,
  onArm: ProdArmId | MechArmId,
  limit = 10
): Array<{ taskId: string; offRank: number | null; onProdRank: number | null; delta: number }> {
  const byTask = new Map<string, { off?: number | null; on?: number | null; pool: number }>()
  for (const row of cases) {
    if (row.arm !== offArm && row.arm !== onArm) continue
    const slot = byTask.get(row.taskId) ?? { pool: Math.max(1, row.rankedIds.length) }
    slot.pool = Math.max(slot.pool, row.rankedIds.length, 1)
    if (row.arm === offArm) slot.off = row.rank
    else slot.on = row.rank
    byTask.set(row.taskId, slot)
  }
  const rows: Array<{
    taskId: string
    offRank: number | null
    onProdRank: number | null
    delta: number
  }> = []
  for (const [taskId, slot] of byTask) {
    if (slot.off === undefined || slot.on === undefined) continue
    const missRank = slot.pool + 1
    const off = slot.off ?? missRank
    const on = slot.on ?? missRank
    // 正 delta = ON 更靠前（排名变小）
    rows.push({
      taskId,
      offRank: slot.off,
      onProdRank: slot.on,
      delta: off - on
    })
  }
  rows.sort(
    (left, right) =>
      Math.abs(right.delta) - Math.abs(left.delta) || left.taskId.localeCompare(right.taskId)
  )
  return rows.slice(0, limit)
}
