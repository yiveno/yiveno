/**
 * 回归基线对比：相对上次存档看 delta（改坏立刻可见）。
 */

import type {
  ClueChainBaselineDelta,
  ClueChainParseReport
} from '@/core/recall/eval/clue-chain/types'

function asReport(raw: unknown): ClueChainParseReport {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('clue-chain 基线不是对象')
  }
  const report = raw as ClueChainParseReport
  if (report.kind !== 'clue-chain-parse' || report.schemaVersion !== 1) {
    throw new Error('clue-chain 基线 kind/schemaVersion 不匹配')
  }
  return report
}

function corePassedIds(report: ClueChainParseReport): Set<string> {
  const ids = new Set<string>()
  for (const row of report.cases) {
    if (row.score.corePassed) {
      ids.add(row.run.id)
    }
  }
  return ids
}

/** 对比当前报告与基线；core/topic/intent 率下降或新增失败 → degraded。 */
export function compareClueChainBaseline(
  current: ClueChainParseReport,
  baselineRaw: unknown,
  baselinePath: string
): ClueChainBaselineDelta {
  const baseline = asReport(baselineRaw)
  const baselinePassed = corePassedIds(baseline)
  const currentPassed = corePassedIds(current)

  const newlyFailedIds: string[] = []
  const newlyPassedIds: string[] = []
  for (const id of baselinePassed) {
    if (!currentPassed.has(id)) {
      newlyFailedIds.push(id)
    }
  }
  for (const id of currentPassed) {
    if (!baselinePassed.has(id)) {
      newlyPassedIds.push(id)
    }
  }
  newlyFailedIds.sort()
  newlyPassedIds.sort()

  const coreRateDelta = current.summary.core.rate - baseline.summary.core.rate
  const topicRateDelta = current.summary.topic.rate - baseline.summary.topic.rate
  const intentRateDelta = current.summary.intent.rate - baseline.summary.intent.rate

  const degraded =
    newlyFailedIds.length > 0 ||
    coreRateDelta < -1e-9 ||
    topicRateDelta < -1e-9 ||
    intentRateDelta < -1e-9

  return {
    baselinePath,
    baselineHead: baseline.head,
    currentHead: current.head,
    coreRateDelta,
    topicRateDelta,
    intentRateDelta,
    newlyFailedIds,
    newlyPassedIds,
    degraded
  }
}

export function formatClueChainBaselineDelta(delta: ClueChainBaselineDelta): string {
  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}pp`
  return [
    `[clue-chain:delta] baseline=${delta.baselinePath} (${delta.baselineHead.slice(0, 8)}) → current=${delta.currentHead.slice(0, 8)}`,
    `[clue-chain:delta] core=${fmt(delta.coreRateDelta)} topic=${fmt(delta.topicRateDelta)} intent=${fmt(delta.intentRateDelta)} degraded=${delta.degraded}`,
    `[clue-chain:delta] newlyFailed=${delta.newlyFailedIds.join(',') || '-'} newlyPassed=${delta.newlyPassedIds.join(',') || '-'}`
  ].join('\n')
}
