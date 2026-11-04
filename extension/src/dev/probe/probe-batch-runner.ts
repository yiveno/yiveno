/**
 * DEV-only：数据驱动批量探针 Runner。
 * 精选目录线索 + 已种库 diversity 带线索条目 → recallWithClue(omnibox) → judgeProbeNeighborhood(k=3)。
 */

import {
  aggregateProbeBatchResults,
  buildProbeBatchCasePlan,
  DEFAULT_PROBE_FILLER_SEED,
  judgeProbeNeighborhood,
  rankedIdsFromRecallResult,
  type ProbeBatchCaseResult,
  type ProbeBatchReport,
  type RecallProbePersonaId
} from '@yiveno/probe'
import { recallService } from '@/application/recall/recall-service'
import type { MemoryItem } from '@/core/memory/memory-item'
import { writeProbeBatchProgress } from '@/dev/probe/probe-batch-progress-storage'
import { readProbeKeyIdMap } from '@/dev/probe/probe-key-id-map-storage'
import { appendProbeRunRecord } from '@/dev/probe/probe-run-history-storage'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export type RunProbeBatchInput = {
  /** 覆盖映射内 seedContext；缺省用映射内上下文 */
  recipeId?: string | undefined
  fillerSeed?: number | undefined
  personas?: readonly RecallProbePersonaId[] | undefined
  diversityBookmarkCount?: number | undefined
  diversityExcerptCount?: number | undefined
}

function topPickDisplayTitle(item: MemoryItem | undefined): string | null {
  if (!item) {
    return null
  }
  if (item.type === 'bookmark') {
    return item.payload.title.trim() || null
  }
  if (item.type === 'text_excerpt') {
    return item.payload.pageTitle.trim() || null
  }
  return null
}

/**
 * 跑完全部带标注线索；持久化运行记录；过程写入进度供 Console 轮询。
 */
export async function runProbeBatch(input: RunProbeBatchInput = {}): Promise<{
  runId: string
  report: ProbeBatchReport
}> {
  if (!import.meta.env.DEV) {
    throw new Error('runProbeBatch 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', '批量探针 Runner')
  const startedAtDate = new Date()
  const startedAtIso = startedAtDate.toISOString()
  const startedAtMs = startedAtDate.getTime()

  try {
    const map = await readProbeKeyIdMap()
    const ctx = map.seedContext
    const personas: readonly RecallProbePersonaId[] =
      input.personas ??
      ctx?.personas ??
      (['researcher', 'creator', 'developer'] satisfies RecallProbePersonaId[])
    const fillerSeed = input.fillerSeed ?? ctx?.fillerSeed ?? DEFAULT_PROBE_FILLER_SEED
    const diversityBookmarkCount = input.diversityBookmarkCount ?? ctx?.diversityBookmarkCount ?? 0
    const diversityExcerptCount = input.diversityExcerptCount ?? ctx?.diversityExcerptCount ?? 0
    const recipeId = input.recipeId ?? ctx?.recipeId ?? 'adhoc'

    const plan = buildProbeBatchCasePlan({
      personas,
      fillerSeed,
      diversityBookmarkCount,
      diversityExcerptCount
    })

    const runIdPreview = `${recipeId}__${fillerSeed}__${startedAtMs}`
    await writeProbeBatchProgress({
      runId: runIdPreview,
      phase: 'running',
      current: 0,
      total: plan.length,
      updatedAtIso: new Date().toISOString()
    })

    logger.info('DevProbe', '批量探针开始', {
      totalCases: plan.length,
      mappedKeys: Object.keys(map.entries).length,
      recipeId,
      fillerSeed
    })

    const rawResults: ProbeBatchCaseResult[] = []
    const shouldWriteProgress = (index: number, total: number): boolean => {
      const current = index + 1
      return current === 1 || current % 10 === 0 || current === total
    }

    for (let index = 0; index < plan.length; index += 1) {
      const casePlan = plan[index]!
      const expectedId = map.entries[casePlan.expectedKey] ?? null

      // 进度节流：第 1 条、每满 10 条、最后一条（避免计入召回延迟）
      if (shouldWriteProgress(index, plan.length)) {
        await writeProbeBatchProgress({
          runId: runIdPreview,
          phase: 'running',
          current: index + 1,
          total: plan.length,
          lastClue: casePlan.clue,
          updatedAtIso: new Date().toISOString()
        })
      }

      if (!expectedId) {
        rawResults.push({
          caseId: casePlan.caseId,
          clue: casePlan.clue,
          expectedKey: casePlan.expectedKey,
          expectedId: null,
          persona: casePlan.persona,
          source: casePlan.source,
          kind: casePlan.kind,
          label: casePlan.label,
          verdict: 'unmapped',
          actualTop1Title: null,
          latencyMs: 0
        })
        continue
      }

      // 计时紧贴 recall，不含进度 storage 写
      const caseStarted = performance.now()
      try {
        const recall = await recallService.recallWithClue(casePlan.clue, { entry: 'omnibox' })
        const latencyMs = Math.round(performance.now() - caseStarted)
        const rankedIds = rankedIdsFromRecallResult(recall)
        const verdict = judgeProbeNeighborhood(rankedIds, expectedId, 3)
        rawResults.push({
          caseId: casePlan.caseId,
          clue: casePlan.clue,
          expectedKey: casePlan.expectedKey,
          expectedId,
          persona: casePlan.persona,
          source: casePlan.source,
          kind: casePlan.kind,
          label: casePlan.label,
          verdict,
          actualTop1Title: topPickDisplayTitle(recall.topPick?.item),
          latencyMs
        })
      } catch (error) {
        rawResults.push({
          caseId: casePlan.caseId,
          clue: casePlan.clue,
          expectedKey: casePlan.expectedKey,
          expectedId,
          persona: casePlan.persona,
          source: casePlan.source,
          kind: casePlan.kind,
          label: casePlan.label,
          verdict: 'error',
          actualTop1Title: null,
          latencyMs: Math.round(performance.now() - caseStarted),
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const finishedAtIso = new Date().toISOString()
    const aggregated = aggregateProbeBatchResults(rawResults)
    const report: ProbeBatchReport = {
      recipeId,
      fillerSeed,
      startedAtIso,
      finishedAtIso,
      cases: aggregated.cases,
      aggregates: {
        total: aggregated.total,
        judged: aggregated.judged,
        top1Count: aggregated.top1Count,
        inTopkCount: aggregated.inTopkCount,
        missCount: aggregated.missCount,
        unmappedCount: aggregated.unmappedCount,
        errorCount: aggregated.errorCount,
        top1Rate: aggregated.top1Rate,
        inTop3Rate: aggregated.inTop3Rate,
        missRate: aggregated.missRate,
        byPersona: aggregated.byPersona,
        bySource: aggregated.bySource,
        latencyMs: aggregated.latencyMs
      }
    }

    const record = await appendProbeRunRecord(report)
    await writeProbeBatchProgress({
      runId: record.runId,
      phase: 'done',
      current: plan.length,
      total: plan.length,
      updatedAtIso: finishedAtIso
    })

    flowOk('DevProbe', '批量探针 Runner', startedAt, {
      runId: record.runId,
      total: report.aggregates.total,
      top1Rate: report.aggregates.top1Rate,
      inTop3Rate: report.aggregates.inTop3Rate,
      unmappedCount: report.aggregates.unmappedCount
    })

    return { runId: record.runId, report }
  } catch (error) {
    await writeProbeBatchProgress({
      runId: `error__${startedAtMs}`,
      phase: 'error',
      current: 0,
      total: 0,
      updatedAtIso: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }).catch(() => {
      // 进度写入失败不掩盖主错误
    })
    flowFail('DevProbe', '批量探针 Runner', startedAt, error)
    throw error
  }
}
