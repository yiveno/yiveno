/**
 * 行为层消融主跑：生产轨四臂 + 机制轨两臂；零 LLM（主跑）。
 */

import {
  BEHAVIOR_ABLATION_BOOTSTRAP_SEED,
  BEHAVIOR_ABLATION_NOW_MS
} from '@/core/recall/eval/behavior-ablation/constants'
import {
  buildMechArmsForTask,
  buildProdArmsForTask,
  isMechConflictTask
} from '@/core/recall/eval/behavior-ablation/arms'
import { pairedBootstrapDeltaCi } from '@/core/recall/eval/behavior-ablation/bootstrap'
import { evaluateFrozenGates } from '@/core/recall/eval/behavior-ablation/gates'
import { hashArmCaseResults } from '@/core/recall/eval/behavior-ablation/hash'
import { mcnemarFromPairedHits } from '@/core/recall/eval/behavior-ablation/mcnemar'
import { mrrContribution } from '@/core/recall/eval/metrics'
import { runArmCase } from '@/core/recall/eval/behavior-ablation/run-case'
import {
  computeArmMetrics,
  pairedR1Hits,
  pairedScalar,
  topRankDeltas
} from '@/core/recall/eval/behavior-ablation/score'
import type {
  ArmCaseResult,
  BehaviorAblationDataset,
  BehaviorAblationRunReport,
  MechArmId,
  ProdArmId
} from '@/core/recall/eval/behavior-ablation/types'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'

async function runAllCases(dataset: BehaviorAblationDataset): Promise<ArmCaseResult[]> {
  const cases: ArmCaseResult[] = []
  const prodTasks = [...dataset.mainTasks, ...dataset.conflictProdTasks]

  for (const task of prodTasks) {
    // 每任务共用同一 parsed 构造四臂（parse 在 runArmCase 内再跑一次以隔离）
    const parsed = parseRecallClue(task.clue.trim(), { nowMs: BEHAVIOR_ABLATION_NOW_MS })
    const arms = buildProdArmsForTask(dataset.corpus, parsed, BEHAVIOR_ABLATION_NOW_MS)
    for (const arm of arms) {
      cases.push(
        await runArmCase({
          task,
          arm: arm.arm,
          corpus: arm.corpus,
          conditions: arm.conditions,
          nowMs: BEHAVIOR_ABLATION_NOW_MS
        })
      )
    }
  }

  for (const task of dataset.conflictMechTasks) {
    if (!isMechConflictTask(task)) continue
    const arms = buildMechArmsForTask(dataset.corpus, task, BEHAVIOR_ABLATION_NOW_MS)
    for (const arm of arms) {
      cases.push(
        await runArmCase({
          task,
          arm: arm.arm,
          corpus: arm.corpus,
          conditions: arm.conditions,
          nowMs: BEHAVIOR_ABLATION_NOW_MS
        })
      )
    }
  }

  cases.sort((left, right) =>
    left.taskId === right.taskId
      ? left.arm.localeCompare(right.arm)
      : left.taskId.localeCompare(right.taskId)
  )
  return cases
}

function buildReportFromCases(
  dataset: BehaviorAblationDataset,
  cases: ArmCaseResult[],
  reproducibility: BehaviorAblationRunReport['meta']['reproducibility'],
  llmArm: BehaviorAblationRunReport['meta']['llmArm'],
  llmArmNote: string
): BehaviorAblationRunReport {
  const prodArms = ['OFF', 'ON-prod', 'ON-beh', 'ON-cond'] as const satisfies readonly ProdArmId[]
  const mechArms = ['B-on', 'B-off'] as const satisfies readonly MechArmId[]

  const prodCases = cases.filter(row => prodArms.includes(row.arm as ProdArmId))
  const mechCases = cases.filter(row => mechArms.includes(row.arm as MechArmId))

  const prodArmMetrics = Object.fromEntries(
    prodArms.map(arm => [arm, computeArmMetrics(arm, prodCases)])
  ) as Record<ProdArmId, ReturnType<typeof computeArmMetrics>>

  const mechArmMetrics = Object.fromEntries(
    mechArms.map(arm => [arm, computeArmMetrics(arm, mechCases)])
  ) as Record<MechArmId, ReturnType<typeof computeArmMetrics>>

  const r1Pairs = pairedR1Hits(prodCases, 'OFF', 'ON-prod')
  const mrrPairs = pairedScalar(prodCases, 'OFF', 'ON-prod', row =>
    mrrContribution(row.rankedIds, row.targetId)
  )
  const falseOpenPairs = pairedScalar(prodCases, 'OFF', 'ON-prod', row => (row.falseOpen ? 1 : 0))
  const mechR1Pairs = pairedR1Hits(mechCases, 'B-off', 'B-on')

  const prodR1 = pairedBootstrapDeltaCi(
    r1Pairs.map(p => ({ a: p.a, b: p.b })),
    BEHAVIOR_ABLATION_BOOTSTRAP_SEED
  )
  const prodMrr = pairedBootstrapDeltaCi(mrrPairs, BEHAVIOR_ABLATION_BOOTSTRAP_SEED ^ 0x11)
  const prodFalseOpen = pairedBootstrapDeltaCi(
    falseOpenPairs,
    BEHAVIOR_ABLATION_BOOTSTRAP_SEED ^ 0x22
  )
  const mechR1 = pairedBootstrapDeltaCi(
    mechR1Pairs.map(p => ({ a: p.a, b: p.b })),
    BEHAVIOR_ABLATION_BOOTSTRAP_SEED ^ 0x33
  )

  const { verdicts, allPassed } = evaluateFrozenGates({
    prodR1,
    prodMrr,
    prodFalseOpen,
    mechR1
  })

  return {
    meta: {
      seed: dataset.meta.seed,
      bootstrapSeed: BEHAVIOR_ABLATION_BOOTSTRAP_SEED,
      nowMs: dataset.meta.nowMs,
      datasetVersion: dataset.meta.version,
      runAtIso: new Date().toISOString(),
      reproducibility,
      llmArm,
      llmArmNote
    },
    prod: {
      arms: prodArmMetrics,
      deltas: {
        onProdMinusOff: { r1: prodR1, mrr: prodMrr, falseOpen: prodFalseOpen },
        mcnemarR1: mcnemarFromPairedHits(r1Pairs)
      },
      worstRankDeltas: topRankDeltas(prodCases, 'OFF', 'ON-prod', 10)
    },
    mech: {
      arms: mechArmMetrics,
      deltas: { bOnMinusBOff: { r1: mechR1 } }
    },
    gates: verdicts,
    gatesAllPassed: allPassed,
    cases
  }
}

/**
 * 主跑连跑两次；排名不一致则抛错（先修 harness）。
 */
export async function runBehaviorAblationTwice(
  dataset: BehaviorAblationDataset,
  options: {
    llmArm?: BehaviorAblationRunReport['meta']['llmArm']
    llmArmNote?: string
  } = {}
): Promise<BehaviorAblationRunReport> {
  const runA = await runAllCases(dataset)
  const runB = await runAllCases(dataset)
  const hashA = hashArmCaseResults(runA)
  const hashB = hashArmCaseResults(runB)
  if (hashA !== hashB) {
    throw new Error(`行为消融两次主跑排名不一致：A=${hashA} B=${hashB}。先修 harness 再出数。`)
  }
  return buildReportFromCases(
    dataset,
    runA,
    { runAHash: hashA, runBHash: hashB, identical: true },
    options.llmArm ?? 'skipped',
    options.llmArmNote ?? '主跑未启用 LLM'
  )
}
