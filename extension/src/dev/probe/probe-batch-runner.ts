/**
 * DEV-only：数据驱动批量探针 Runner。
 * 精选 / diversity / cluster / 负例 → recallWithClue(omnibox) → 邻域或集合判定 / 负例判定。
 */

import {
  aggregateProbeBatchResults,
  buildProbeBatchCasePlan,
  DEFAULT_PROBE_FILLER_SEED,
  judgeProbeNeighborhood,
  judgeProbeNeighborhoodForSet,
  rankedIdsFromRecallResult,
  type ProbeBatchCaseResult,
  type ProbeBatchReport,
  type RecallProbePersonaId
} from '@yiveno/probe'
import { recallService } from '@/application/recall/recall-service'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  clearProbeBatchProgress,
  writeProbeBatchProgress
} from '@/dev/probe/probe-batch-progress-storage'
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
  clusterBookmarkCount?: number | undefined
  clusterExcerptCount?: number | undefined
  includeNegatives?: boolean | undefined
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
    const clusterBookmarkCount = input.clusterBookmarkCount ?? ctx?.clusterBookmarkCount ?? 0
    const clusterExcerptCount = input.clusterExcerptCount ?? ctx?.clusterExcerptCount ?? 0
    const includeNegatives = input.includeNegatives ?? true
    const recipeId = input.recipeId ?? ctx?.recipeId ?? 'adhoc'

    const plan = buildProbeBatchCasePlan({
      personas,
      fillerSeed,
      diversityBookmarkCount,
      diversityExcerptCount,
      clusterBookmarkCount,
      clusterExcerptCount,
      includeNegatives
    })

    const runIdPreview = `${recipeId}__${fillerSeed}__${startedAtMs}`
    // 新批次前清旧进度，避免 Console 读到上一轮残片
    await clearProbeBatchProgress()
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
      fillerSeed,
      clusterBookmarkCount,
      clusterExcerptCount
    })

    const rawResults: ProbeBatchCaseResult[] = []
    const shouldWriteProgress = (index: number, total: number): boolean => {
      const current = index + 1
      return current === 1 || current % 10 === 0 || current === total
    }

    for (let index = 0; index < plan.length; index += 1) {
      const casePlan = plan[index]!

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

      // 负例：不查映射
      if (casePlan.source === 'negative') {
        const caseStarted = performance.now()
        try {
          const recall = await recallService.recallWithClue(casePlan.clue, { entry: 'omnibox' })
          const latencyMs = Math.round(performance.now() - caseStarted)
          const hasTop = recall.topPick != null
          rawResults.push({
            caseId: casePlan.caseId,
            clue: casePlan.clue,
            clueType: casePlan.clueType,
            expectedKey: '',
            expectedId: null,
            persona: casePlan.persona,
            source: 'negative',
            kind: 'negative',
            label: casePlan.label,
            verdict: hasTop ? 'false_positive' : 'rejected',
            actualTop1Title: topPickDisplayTitle(recall.topPick?.item),
            latencyMs
          })
        } catch (error) {
          rawResults.push({
            caseId: casePlan.caseId,
            clue: casePlan.clue,
            clueType: casePlan.clueType,
            expectedKey: '',
            expectedId: null,
            persona: casePlan.persona,
            source: 'negative',
            kind: 'negative',
            label: casePlan.label,
            verdict: 'error',
            actualTop1Title: null,
            latencyMs: Math.round(performance.now() - caseStarted),
            error: error instanceof Error ? error.message : String(error)
          })
        }
        continue
      }

      // 集合 case（ambiguous）
      if (casePlan.expectedKeys && casePlan.preferredKey) {
        const expectedIds = casePlan.expectedKeys
          .map(key => map.entries[key])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
        const preferredId = map.entries[casePlan.preferredKey] ?? null
        if (!preferredId || expectedIds.length !== casePlan.expectedKeys.length) {
          rawResults.push({
            caseId: casePlan.caseId,
            clue: casePlan.clue,
            clueType: casePlan.clueType,
            expectedKey: casePlan.expectedKey,
            expectedId: preferredId,
            expectedIds: expectedIds.length > 0 ? expectedIds : undefined,
            preferredId: preferredId ?? undefined,
            clusterId: casePlan.clusterId,
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

        const caseStarted = performance.now()
        try {
          const recall = await recallService.recallWithClue(casePlan.clue, { entry: 'omnibox' })
          const latencyMs = Math.round(performance.now() - caseStarted)
          const rankedIds = rankedIdsFromRecallResult(recall)
          const verdict = judgeProbeNeighborhoodForSet(rankedIds, expectedIds, preferredId, 3)
          rawResults.push({
            caseId: casePlan.caseId,
            clue: casePlan.clue,
            clueType: casePlan.clueType,
            expectedKey: casePlan.expectedKey,
            expectedId: preferredId,
            expectedIds,
            preferredId,
            clusterId: casePlan.clusterId,
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
            clueType: casePlan.clueType,
            expectedKey: casePlan.expectedKey,
            expectedId: preferredId,
            expectedIds,
            preferredId,
            clusterId: casePlan.clusterId,
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
        continue
      }

      const expectedId = map.entries[casePlan.expectedKey] ?? null
      if (!expectedId) {
        rawResults.push({
          caseId: casePlan.caseId,
          clue: casePlan.clue,
          clueType: casePlan.clueType,
          expectedKey: casePlan.expectedKey,
          expectedId: null,
          clusterId: casePlan.clusterId,
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

      const caseStarted = performance.now()
      try {
        const recall = await recallService.recallWithClue(casePlan.clue, { entry: 'omnibox' })
        const latencyMs = Math.round(performance.now() - caseStarted)
        const rankedIds = rankedIdsFromRecallResult(recall)
        const verdict = judgeProbeNeighborhood(rankedIds, expectedId, 3)
        rawResults.push({
          caseId: casePlan.caseId,
          clue: casePlan.clue,
          clueType: casePlan.clueType,
          expectedKey: casePlan.expectedKey,
          expectedId,
          clusterId: casePlan.clusterId,
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
          clueType: casePlan.clueType,
          expectedKey: casePlan.expectedKey,
          expectedId,
          clusterId: casePlan.clusterId,
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
        byClueType: aggregated.byClueType,
        clusters: aggregated.clusters,
        negatives: aggregated.negatives,
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
      unmappedCount: report.aggregates.unmappedCount,
      clusterAnyHitRate: report.aggregates.clusters?.anyHitRate,
      negativeFpRate: report.aggregates.negatives?.falsePositiveRate
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
