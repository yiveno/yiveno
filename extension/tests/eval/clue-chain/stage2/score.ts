/**
 * Stage 2 指标：Recall@1/3/5、MRR、平均排名、负例误命中率；按档位 / 簇拆分。
 */

import type {
  Stage2CaseResult,
  Stage2ClueTier,
  Stage2FailStage,
  Stage2MetricBlock,
  Stage2ReportSummary
} from './types'
import { meanMrr, meanRecallAtK, rankOfGold } from '../../metrics'

function emptyMetricBlock(): Stage2MetricBlock {
  return {
    n: 0,
    recallAt1: 0,
    recallAt3: 0,
    recallAt5: 0,
    mrr: 0,
    meanRank: null,
    missRate: 0
  }
}

/** 正例子集 → 指标块。 */
export function computePositiveMetrics(cases: readonly Stage2CaseResult[]): Stage2MetricBlock {
  const positive = cases.filter(row => row.tier !== 'negative' && row.targetId != null)
  if (positive.length === 0) {
    return emptyMetricBlock()
  }
  const queries = positive.map(row => ({
    rankedIds: row.rankedIds,
    goldId: row.targetId!
  }))
  const r1 = meanRecallAtK(queries, 1)
  const r3 = meanRecallAtK(queries, 3)
  const r5 = meanRecallAtK(queries, 5)
  const mrr = meanMrr(queries)

  let rankSum = 0
  let rankN = 0
  let miss = 0
  for (const row of positive) {
    const rank = rankOfGold(row.rankedIds, row.targetId!)
    if (rank === null) {
      miss += 1
    } else {
      rankSum += rank
      rankN += 1
    }
  }

  return {
    n: positive.length,
    recallAt1: r1.mean ?? 0,
    recallAt3: r3.mean ?? 0,
    recallAt5: r5.mean ?? 0,
    mrr: mrr.mean ?? 0,
    meanRank: rankN === 0 ? null : rankSum / rankN,
    missRate: miss / positive.length
  }
}

function stageCountsInit(): Record<Stage2FailStage, number> {
  return {
    parse: 0,
    filtered: 0,
    rank: 0,
    false_hit: 0,
    ok: 0,
    error: 0
  }
}

/** 全量结果 → 报告 summary。 */
export function computeStage2Summary(cases: readonly Stage2CaseResult[]): Stage2ReportSummary {
  const positive = cases.filter(row => row.tier !== 'negative')
  const negatives = cases.filter(row => row.tier === 'negative')
  const positiveMetrics = computePositiveMetrics(positive)

  let negativeFalseHits = 0
  for (const row of negatives) {
    if (row.stage === 'false_hit' || row.rankedIds.length > 0) {
      negativeFalseHits += 1
    }
  }

  const tiers: Stage2ClueTier[] = ['concrete', 'semi_fuzzy', 'vague', 'negative']
  const byTier: Stage2ReportSummary['byTier'] = {
    concrete: emptyMetricBlock(),
    semi_fuzzy: emptyMetricBlock(),
    vague: emptyMetricBlock(),
    negative: { n: 0, falseHitRate: 0 }
  }

  for (const tier of tiers) {
    const subset = cases.filter(row => row.tier === tier)
    if (tier === 'negative') {
      const hits = subset.filter(row => row.rankedIds.length > 0).length
      byTier.negative = {
        n: subset.length,
        falseHitRate: subset.length === 0 ? 0 : hits / subset.length
      }
    } else {
      byTier[tier] = computePositiveMetrics(subset)
    }
  }

  const byCluster: Record<string, Stage2MetricBlock> = {}
  const clusterIds = [
    ...new Set(positive.map(row => row.clusterId).filter(id => !id.startsWith('neg-')))
  ].sort()
  for (const clusterId of clusterIds) {
    byCluster[clusterId] = computePositiveMetrics(
      positive.filter(row => row.clusterId === clusterId)
    )
  }

  const stageCounts = stageCountsInit()
  for (const row of cases) {
    stageCounts[row.stage] += 1
  }

  return {
    totalTasks: cases.length,
    positiveTasks: positive.length,
    negativeTasks: negatives.length,
    positive: positiveMetrics,
    negativeFalseHitRate: negatives.length === 0 ? 0 : negativeFalseHits / negatives.length,
    negativeFalseHits,
    byTier,
    byCluster,
    stageCounts
  }
}
