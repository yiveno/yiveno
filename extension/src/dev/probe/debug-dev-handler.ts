/**
 * DEV Background 消息处理。
 * 服务均为静态 import：避免 SW 内嵌套 dynamic import 触发 Vite preload（会碰 document/window）。
 * 仍由 message-handler 在 DEV 分支动态加载本模块，便于 production 剔除语料。
 */

import { diffProbeBatchAggregates } from '@yiveno/probe'
import type { BackgroundMessage } from '@/core/messaging/background-messages'
import {
  parseBackdateMemorySavedAtPayload,
  parseDiffProbeRunsPayload,
  parseGetProbeRunPayload,
  parseListProbeFixturesPayload,
  parseProbeCleanupPayload,
  parseRunProbeBatchPayload,
  parseSeedRecallProbePayload,
  type DebugBackgroundResponse,
  type DevBackdateMemorySavedAtResponse,
  type DevColdMemoryImpactResponse,
  type DevColdMemoryLatencyResponse,
  type DevDiffProbeRunsResponse,
  type DevGetProbeBatchProgressResponse,
  type DevGetProbeRunResponse,
  type DevListProbeFixturesResponse,
  type DevListProbeRunsResponse,
  type DevProbeCleanupResponse,
  type DevProbeLibrarySnapshotResponse,
  type DevPurgeProbeNoiseResponse,
  type DevRunProbeBatchResponse,
  type DevSeedRecallProbeResponse
} from '@/core/messaging/debug-messages'
import { backdateMemorySavedAt } from '@/infrastructure/debug/memory-dev-backdate-saved-at'
import type { BackdateMemorySavedAtInput } from '@/infrastructure/debug/memory-dev-backdate-saved-at'
import { runProbeBatch } from '@/dev/probe/probe-batch-runner'
import { readProbeBatchProgress } from '@/dev/probe/probe-batch-progress-storage'
import { listProbeFixtureCatalog } from '@/dev/probe/probe-fixture-catalog'
import { buildColdMemoryImpactReport } from '@/dev/probe/probe-cold-memory-impact'
import {
  PROBE_COLD_MEMORY_CLUE,
  measureRecallFallbackLatency
} from '@/dev/probe/probe-cold-memory-latency'
import { buildProbeLibrarySnapshot } from '@/dev/probe/probe-library-snapshot'
import {
  getProbeRunRecord,
  listProbeRunHistorySummaries
} from '@/dev/probe/probe-run-history-storage'
import { cleanupProbeLibrary } from '@/dev/probe/recall-probe-cleanup-service'
import { purgeProbeNoiseFromLibrary } from '@/dev/probe/recall-probe-purge-service'
import { seedRecallProbeCorpus } from '@/dev/probe/recall-probe-seed-service'

/** 处理全部 DEV_* 消息。 */
export async function handleDebugBackgroundMessage(
  message: Extract<BackgroundMessage, { type: `DEV_${string}` }>
): Promise<DebugBackgroundResponse> {
  if (!import.meta.env.DEV) {
    return {
      ok: false,
      errorCode: 'DEV_ONLY',
      error: `${message.type} 仅开发构建可用`
    }
  }

  switch (message.type) {
    case 'DEV_SEED_RECALL_PROBE': {
      try {
        const parsed = parseSeedRecallProbePayload(message.payload)
        const result = await seedRecallProbeCorpus(parsed)
        const ok: DevSeedRecallProbeResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevSeedRecallProbeResponse = {
          ok: false,
          errorCode: 'DEV_SEED_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_PURGE_PROBE_NOISE': {
      try {
        const result = await purgeProbeNoiseFromLibrary()
        const ok: DevPurgeProbeNoiseResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevPurgeProbeNoiseResponse = {
          ok: false,
          errorCode: 'DEV_PURGE_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_PROBE_CLEANUP': {
      try {
        const parsed = parseProbeCleanupPayload(message.payload)
        const result = await cleanupProbeLibrary(parsed)
        const ok: DevProbeCleanupResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevProbeCleanupResponse = {
          ok: false,
          errorCode: 'DEV_PURGE_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_BACKDATE_MEMORY_SAVED_AT': {
      try {
        const parsed = parseBackdateMemorySavedAtPayload(message.payload)
        const input: BackdateMemorySavedAtInput = { ids: parsed.ids }
        if (parsed.daysAgo !== undefined) {
          input.daysAgo = parsed.daysAgo
        } else if (parsed.savedAtIso !== undefined) {
          input.savedAtIso = parsed.savedAtIso
        }
        const result = await backdateMemorySavedAt(input)
        const ok: DevBackdateMemorySavedAtResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevBackdateMemorySavedAtResponse = {
          ok: false,
          errorCode: 'DEV_BACKDATE_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_PROBE_LIBRARY_SNAPSHOT': {
      try {
        const snapshot = await buildProbeLibrarySnapshot()
        const ok: DevProbeLibrarySnapshotResponse = { ok: true, ...snapshot }
        return ok
      } catch (error) {
        const failed: DevProbeLibrarySnapshotResponse = {
          ok: false,
          errorCode: 'DEV_SNAPSHOT_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_LIST_PROBE_FIXTURES': {
      try {
        const parsed = parseListProbeFixturesPayload(message.payload)
        const catalog =
          parsed?.personas !== undefined
            ? listProbeFixtureCatalog(parsed.personas)
            : listProbeFixtureCatalog()
        const ok: DevListProbeFixturesResponse = {
          ok: true,
          defaultPersonas: [...catalog.defaultPersonas],
          personaOrder: [...catalog.personaOrder],
          rows: catalog.rows
        }
        return ok
      } catch (error) {
        const failed: DevListProbeFixturesResponse = {
          ok: false,
          errorCode: 'DEV_FIXTURES_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_COLD_MEMORY_IMPACT': {
      try {
        const report = await buildColdMemoryImpactReport()
        const ok: DevColdMemoryImpactResponse = {
          ok: true,
          totalCount: report.totalCount,
          probeTruncated: report.probeTruncated,
          beyondLimitCount: report.beyondLimitCount,
          beyondLimitRate: report.beyondLimitRate,
          indexedCount: report.indexedCount,
          indexedRate: report.indexedRate,
          beyondLimitIndexedCount: report.beyondLimitIndexedCount,
          beyondLimitIndexedRate: report.beyondLimitIndexedRate,
          oldestBeyondLimitIso: report.oldestBeyondLimitIso,
          newestBeyondLimitIso: report.newestBeyondLimitIso,
          byType: report.byType,
          byLayer: report.byLayer,
          scanLimit: report.scanLimit
        }
        return ok
      } catch (error) {
        const failed: DevColdMemoryImpactResponse = {
          ok: false,
          errorCode: 'DEV_COLD_MEMORY_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_COLD_MEMORY_LATENCY': {
      try {
        const clue =
          (message.payload as { clue?: string } | undefined)?.clue ?? PROBE_COLD_MEMORY_CLUE
        const result = await measureRecallFallbackLatency(clue)
        const ok: DevColdMemoryLatencyResponse = {
          ok: true,
          seedSize: result.seedSize,
          recallLatencyMs: result.recallLatencyMs,
          itemsReturned: result.itemsReturned,
          recallSource: result.recallSource,
          clue: result.clue
        }
        return ok
      } catch (error) {
        const failed: DevColdMemoryLatencyResponse = {
          ok: false,
          errorCode: 'DEV_COLD_MEMORY_LATENCY_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_RUN_PROBE_BATCH': {
      try {
        const parsed = parseRunProbeBatchPayload(message.payload)
        const result = await runProbeBatch(parsed)
        const ok: DevRunProbeBatchResponse = {
          ok: true,
          runId: result.runId,
          report: result.report
        }
        return ok
      } catch (error) {
        const failed: DevRunProbeBatchResponse = {
          ok: false,
          errorCode: 'DEV_PROBE_BATCH_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_GET_PROBE_BATCH_PROGRESS': {
      try {
        const progress = await readProbeBatchProgress()
        const ok: DevGetProbeBatchProgressResponse = { ok: true, progress }
        return ok
      } catch (error) {
        const failed: DevGetProbeBatchProgressResponse = {
          ok: false,
          errorCode: 'DEV_PROBE_BATCH_PROGRESS_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_LIST_PROBE_RUNS': {
      try {
        const runs = await listProbeRunHistorySummaries()
        const ok: DevListProbeRunsResponse = { ok: true, runs }
        return ok
      } catch (error) {
        const failed: DevListProbeRunsResponse = {
          ok: false,
          errorCode: 'DEV_PROBE_RUNS_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_GET_PROBE_RUN': {
      try {
        const parsed = parseGetProbeRunPayload(message.payload)
        const record = await getProbeRunRecord(parsed.runId)
        if (!record) {
          const missing: DevGetProbeRunResponse = {
            ok: false,
            errorCode: 'DEV_PROBE_RUN_NOT_FOUND',
            error: `未找到运行 ${parsed.runId}`
          }
          return missing
        }
        const ok: DevGetProbeRunResponse = {
          ok: true,
          runId: record.runId,
          report: record.report
        }
        return ok
      } catch (error) {
        const failed: DevGetProbeRunResponse = {
          ok: false,
          errorCode: 'DEV_PROBE_RUNS_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_DIFF_PROBE_RUNS': {
      try {
        const parsed = parseDiffProbeRunsPayload(message.payload)
        const before = await getProbeRunRecord(parsed.beforeRunId)
        const after = await getProbeRunRecord(parsed.afterRunId)
        if (!before || !after) {
          const missing: DevDiffProbeRunsResponse = {
            ok: false,
            errorCode: 'DEV_PROBE_RUN_NOT_FOUND',
            error: !before ? `未找到运行 ${parsed.beforeRunId}` : `未找到运行 ${parsed.afterRunId}`
          }
          return missing
        }
        const diff = diffProbeBatchAggregates({
          beforeRunId: before.runId,
          afterRunId: after.runId,
          before: before.report.aggregates,
          after: after.report.aggregates
        })
        const ok: DevDiffProbeRunsResponse = {
          ok: true,
          beforeRunId: diff.beforeRunId,
          afterRunId: diff.afterRunId,
          rows: diff.rows
        }
        return ok
      } catch (error) {
        const failed: DevDiffProbeRunsResponse = {
          ok: false,
          errorCode: 'DEV_PROBE_DIFF_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    default: {
      return {
        ok: false,
        errorCode: 'DEV_ONLY',
        error: `未处理的 DEV 消息: ${(message as { type: string }).type}`
      }
    }
  }
}
