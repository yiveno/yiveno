/**
 * Stage 2 报告：失败聚类、最差样本、控制台摘要、建议门禁观测。
 */

import { CLUE_CHAIN_STAGE2_SUGGESTED_GATES } from './constants'
import { computeStage2Summary } from './score'
import type { Stage2CaseResult, Stage2FailureCluster, Stage2Report, Stage2WorstCase } from './types'

function isPositiveMetric(
  block: Stage2Report['summary']['byTier'][keyof Stage2Report['summary']['byTier']]
): block is Stage2Report['summary']['positive'] {
  return 'recallAt1' in block
}

/** 失败聚类：stage + tier。 */
export function buildStage2FailureClusters(
  cases: readonly Stage2CaseResult[]
): Stage2FailureCluster[] {
  const map = new Map<string, Stage2FailureCluster>()
  for (const row of cases) {
    if (row.stage === 'ok') continue
    const key = `${row.stage}|${row.tier}`
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      existing.ids.push(row.taskId)
    } else {
      map.set(key, {
        key,
        stage: row.stage,
        tier: row.tier,
        count: 1,
        ids: [row.taskId]
      })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/**
 * 最差样本：优先 error / false_hit / filtered / parse / rank（高位次更差）。
 */
export function pickStage2WorstCases(
  cases: readonly Stage2CaseResult[],
  limit = 20
): Stage2WorstCase[] {
  const severity: Record<Stage2CaseResult['stage'], number> = {
    error: 100,
    false_hit: 90,
    parse: 80,
    filtered: 70,
    rank: 40,
    ok: 0
  }

  const scored = cases
    .filter(row => row.stage !== 'ok')
    .map(row => {
      const rankPenalty = row.rank == null ? 50 : Math.min(row.rank, 40)
      const score = severity[row.stage] + (row.stage === 'rank' ? rankPenalty : 0)
      return { row, score }
    })
    .sort((a, b) => b.score - a.score || a.row.taskId.localeCompare(b.row.taskId))

  return scored.slice(0, limit).map(({ row }) => ({
    taskId: row.taskId,
    tier: row.tier,
    clue: row.clue,
    targetId: row.targetId,
    top3: row.top3,
    rank: row.rank,
    stage: row.stage,
    detail: row.detail
  }))
}

function observeSuggestedGates(
  summary: Stage2Report['summary']
): Stage2Report['suggestedGateObservations'] {
  const gates = CLUE_CHAIN_STAGE2_SUGGESTED_GATES
  const concrete = summary.byTier.concrete
  const concreteR1 = isPositiveMetric(concrete) ? concrete.recallAt1 : 0

  return [
    {
      id: 'positive_r1',
      observed: summary.positive.recallAt1,
      threshold: gates.positiveRecallAt1Min,
      passed: summary.positive.recallAt1 >= gates.positiveRecallAt1Min,
      detail: `正例 R@1 ${summary.positive.recallAt1.toFixed(3)} ≥ ${gates.positiveRecallAt1Min}`
    },
    {
      id: 'positive_r5',
      observed: summary.positive.recallAt5,
      threshold: gates.positiveRecallAt5Min,
      passed: summary.positive.recallAt5 >= gates.positiveRecallAt5Min,
      detail: `正例 R@5 ${summary.positive.recallAt5.toFixed(3)} ≥ ${gates.positiveRecallAt5Min}`
    },
    {
      id: 'positive_mrr',
      observed: summary.positive.mrr,
      threshold: gates.positiveMrrMin,
      passed: summary.positive.mrr >= gates.positiveMrrMin,
      detail: `正例 MRR ${summary.positive.mrr.toFixed(3)} ≥ ${gates.positiveMrrMin}`
    },
    {
      id: 'concrete_r1',
      observed: concreteR1,
      threshold: gates.concreteRecallAt1Min,
      passed: concreteR1 >= gates.concreteRecallAt1Min,
      detail: `concrete R@1 ${concreteR1.toFixed(3)} ≥ ${gates.concreteRecallAt1Min}`
    },
    {
      id: 'negative_false_hit',
      observed: summary.negativeFalseHitRate,
      threshold: gates.negativeFalseHitMax,
      passed: summary.negativeFalseHitRate <= gates.negativeFalseHitMax,
      detail: `负例误命中 ${summary.negativeFalseHitRate.toFixed(3)} ≤ ${gates.negativeFalseHitMax}`
    }
  ]
}

/** 组装完整报告。 */
export function buildStage2Report(input: {
  head: string
  startedAt: string
  finishedAt: string
  seed: number
  nowMs: number
  cases: readonly Stage2CaseResult[]
}): Stage2Report {
  const summary = computeStage2Summary(input.cases)
  return {
    schemaVersion: 1,
    kind: 'clue-chain-stage2-recall',
    head: input.head,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    seed: input.seed,
    nowMs: input.nowMs,
    track: {
      parse: 'rules',
      embedding: 'fake',
      llm: false
    },
    summary,
    suggestedGates: { ...CLUE_CHAIN_STAGE2_SUGGESTED_GATES },
    suggestedGateObservations: observeSuggestedGates(summary),
    clusters: buildStage2FailureClusters(input.cases),
    worst20: pickStage2WorstCases(input.cases, 20),
    cases: [...input.cases]
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

/** 控制台摘要。 */
export function formatStage2ReportConsole(report: Stage2Report): string {
  const { summary } = report
  const lines: string[] = [
    `clue-chain stage2 · head=${report.head.slice(0, 8)} · tasks=${summary.totalTasks}`,
    `track: rules + fake embed · llm=false · seed=${report.seed}`,
    `positive R@1=${pct(summary.positive.recallAt1)} R@3=${pct(summary.positive.recallAt3)} R@5=${pct(summary.positive.recallAt5)} MRR=${summary.positive.mrr.toFixed(3)} meanRank=${summary.positive.meanRank?.toFixed(2) ?? 'n/a'}`,
    `negative falseHit=${pct(summary.negativeFalseHitRate)} (${summary.negativeFalseHits}/${summary.negativeTasks})`,
    `stages: ${Object.entries(summary.stageCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`
  ]

  for (const tier of ['concrete', 'semi_fuzzy', 'vague'] as const) {
    const block = summary.byTier[tier]
    if (isPositiveMetric(block)) {
      lines.push(
        `  ${tier}: n=${block.n} R@1=${pct(block.recallAt1)} R@5=${pct(block.recallAt5)} MRR=${block.mrr.toFixed(3)}`
      )
    }
  }
  const neg = summary.byTier.negative
  if ('falseHitRate' in neg) {
    lines.push(`  negative: n=${neg.n} falseHit=${pct(neg.falseHitRate)}`)
  }

  lines.push('suggested gates:')
  for (const obs of report.suggestedGateObservations) {
    lines.push(`  ${obs.passed ? 'PASS' : 'FAIL'} ${obs.id}: ${obs.detail}`)
  }

  if (report.clusters.length > 0) {
    lines.push('failure clusters (top):')
    for (const cluster of report.clusters.slice(0, 8)) {
      lines.push(`  ${cluster.key} ×${cluster.count}`)
    }
  }

  if (report.worst20.length > 0) {
    lines.push('worst samples:')
    for (const worst of report.worst20.slice(0, 8)) {
      lines.push(
        `  ${worst.taskId} [${worst.tier}/${worst.stage}] rank=${worst.rank ?? 'miss'} top3=[${worst.top3.join(',')}] clue="${worst.clue.slice(0, 60)}"`
      )
    }
  }

  return lines.join('\n')
}
