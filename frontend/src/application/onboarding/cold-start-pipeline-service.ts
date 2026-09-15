/**
 * 冷启动三阶段门禁编排：library align → 规则 enrichment 全量 → embed/LLM 尽力。
 * 书签 bulk 用户主进度在 Getting Started；本 pipeline 的 import 阶段仅为等待/幂等对齐。
 * Getting Started 可跳过；本 pipeline 是 Side Panel 全屏进度的工程门禁。
 */

import {
  ensureChromeBookmarksImported,
  getChromeBookmarkImportStatus
} from '@/application/capture/import-chrome-bookmarks-service'
import { ensureMemoryEnrichmentBackfilled } from '@/application/memory/ensure-memory-enrichment-backfill'
import {
  runSilentMemoryEmbeddingMaintenance,
  scheduleSilentMemoryEmbeddingMaintenance
} from '@/application/memory/ensure-memory-embedding-maintenance'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { beginColdStartEnrichmentBatch } from '@/application/onboarding/cold-start-enrichment-batch-store'
import { shouldRequestLlmMemoryEnrichment } from '@/core/memory/should-request-llm-memory-enrichment'
import {
  COLD_START_PIPELINE_STORAGE_KEY,
  COLD_START_PIPELINE_VERSION,
  ColdStartPipelineStateSchema,
  type ColdStartPipelineState,
  type ColdStartReleaseReason
} from '@/core/memory/cold-start-pipeline-state'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { readInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** bootstrap 延迟启动，避开 reload 尖峰。 */
export const COLD_START_PIPELINE_START_DELAY_MS = 500

/**
 * AI 尽力阶段最长等待（占位可调）。实际等待取 min(本值, 按任务量估算)。
 * 产品文档 §5.8.1：具体秒数为占位，不挡方向。
 */
export const COLD_START_AI_BEST_EFFORT_TIMEOUT_MS = 45_000

/** AI 阶段最短停留，让进度文案可见（小库）。 */
export const COLD_START_AI_MIN_BURST_MS = 4_000

/** 冷启动 LLM 尽力入队上限（占位；与 embed batch 同量级）。 */
export const COLD_START_LLM_ENQUEUE_LIMIT = 40

/** 扫描上限，与 enrichment 回填对齐。 */
const COLD_START_LLM_SCAN_LIMIT = 10000

let pipelineInFlight: Promise<ColdStartPipelineState> | null = null
let importProgressTimer: ReturnType<typeof setInterval> | null = null

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function createPendingState(): ColdStartPipelineState {
  return {
    version: COLD_START_PIPELINE_VERSION,
    status: 'pending',
    stage: 'idle',
    importImportedCount: 0,
    rulesScanned: 0,
    rulesUpdated: 0,
    aiEmbedAttempted: 0,
    aiEmbedWritten: 0,
    aiLlmEnqueued: 0
  }
}

async function writeState(state: ColdStartPipelineState): Promise<ColdStartPipelineState> {
  await writeChromeStorageLocal(COLD_START_PIPELINE_STORAGE_KEY, state)
  return state
}

async function patchState(
  patch: Partial<ColdStartPipelineState> &
    Pick<ColdStartPipelineState, 'status' | 'stage' | 'version'>
): Promise<ColdStartPipelineState> {
  const current = (await readColdStartPipelineState()) ?? createPendingState()
  const next: ColdStartPipelineState = {
    ...current,
    ...patch,
    version: COLD_START_PIPELINE_VERSION
  }
  return writeState(next)
}

/** 读取门禁状态（不触发 pipeline）。 */
export async function readColdStartPipelineState(): Promise<ColdStartPipelineState | null> {
  return readChromeStorageLocal(COLD_START_PIPELINE_STORAGE_KEY, ColdStartPipelineStateSchema)
}

/**
 * 存量迁移：书签导入已完成、引导已走过、且尚无冷启动状态 → ready，不重弹门禁。
 * **首次 install / 重装**（`installOnboardingDone === false`）绝不迁移，必须走全屏门禁。
 */
async function migrateExistingIfEligible(): Promise<ColdStartPipelineState | null> {
  const existing = await readColdStartPipelineState()
  if (existing?.status === 'ready' && existing.version >= COLD_START_PIPELINE_VERSION) {
    return existing
  }
  if (existing?.status === 'running' || existing?.status === 'pending') {
    return null
  }

  const importState = await getChromeBookmarkImportStatus()
  const importDone = importState?.status === 'completed'

  if (!importDone || existing !== null) {
    return null
  }

  // 重装 / 首装：引导未完成 → 强制走门禁（即便 import 状态残留 completed）
  const onboardingDone = await readInstallOnboardingDone()
  if (!onboardingDone) {
    logger.info('ColdStart', '首次引导未完成，跳过存量迁移，走全屏门禁', {
      importedCount: importState.importedCount
    })
    return null
  }

  const ready: ColdStartPipelineState = {
    ...createPendingState(),
    status: 'ready',
    stage: 'done',
    releaseReason: 'migrated_existing',
    importImportedCount: importState.importedCount,
    ...(importState.totalCount !== undefined ? { importTotalCount: importState.totalCount } : {}),
    readyAt: new Date().toISOString()
  }
  logger.info('ColdStart', '存量用户迁移为 ready，跳过全屏门禁', {
    importedCount: importState.importedCount
  })
  return writeState(ready)
}

async function markReady(
  releaseReason: ColdStartReleaseReason,
  patch: Partial<ColdStartPipelineState> = {}
): Promise<ColdStartPipelineState> {
  return patchState({
    status: 'ready',
    stage: 'done',
    version: COLD_START_PIPELINE_VERSION,
    releaseReason,
    readyAt: new Date().toISOString(),
    ...patch
  })
}

function stopImportProgressPolling(): void {
  if (importProgressTimer !== null) {
    clearInterval(importProgressTimer)
    importProgressTimer = null
  }
}

/**
 * Import 阶段：非二次授权课。
 * - ingest 关：跳过（外层已直接进 rules；此处兜底）
 * - ingest 开：幂等 `ensureChromeBookmarksImported`（已 completed 则立刻返回）= 对齐/等待已有导入终态
 */
async function runImportStage(): Promise<{ failed: boolean; error?: string }> {
  const settings = await getUserSettings()
  if (!settings.chromeBookmarkIngestEnabled) {
    await patchState({
      status: 'running',
      stage: 'import',
      version: COLD_START_PIPELINE_VERSION
    })
    return { failed: false }
  }

  await patchState({
    status: 'running',
    stage: 'import',
    version: COLD_START_PIPELINE_VERSION,
    startedAt: new Date().toISOString()
  })

  stopImportProgressPolling()
  importProgressTimer = setInterval(() => {
    void (async () => {
      const importState = await getChromeBookmarkImportStatus()
      if (!importState) {
        return
      }
      await patchState({
        status: 'running',
        stage: 'import',
        version: COLD_START_PIPELINE_VERSION,
        importImportedCount: importState.importedCount,
        ...(importState.totalCount !== undefined
          ? { importTotalCount: importState.totalCount }
          : {})
      })
    })()
  }, 300)

  try {
    // 幂等：Settings/GS 已启动的 bulk 会续跑；已完成则立刻返回
    const result = await ensureChromeBookmarksImported()
    stopImportProgressPolling()
    await patchState({
      status: 'running',
      stage: 'import',
      version: COLD_START_PIPELINE_VERSION,
      importImportedCount: result.importedCount,
      ...(result.totalCount !== undefined ? { importTotalCount: result.totalCount } : {})
    })
    if (result.status === 'failed') {
      return {
        failed: true,
        ...(result.error ? { error: result.error } : {})
      }
    }
    return { failed: false }
  } catch (error) {
    stopImportProgressPolling()
    return {
      failed: true,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function runRulesStage(): Promise<void> {
  await patchState({
    status: 'running',
    stage: 'rules',
    version: COLD_START_PIPELINE_VERSION
  })
  const result = await ensureMemoryEnrichmentBackfilled()
  await patchState({
    status: 'running',
    stage: 'rules',
    version: COLD_START_PIPELINE_VERSION,
    rulesScanned: result.scanned,
    rulesUpdated: result.updated
  })
}

/**
 * 冷启动 LLM 尽力：扫描缺 summary 且信号足够的条目，限量入队。
 * 日常 bulk/sync 仍不调度；仅本门禁阶段。
 */
async function enqueueColdStartLlmEnrichment(): Promise<number> {
  const items = await memoryItemRepository.listByOwner({ limit: COLD_START_LLM_SCAN_LIMIT })
  const toEnqueue: string[] = []
  for (const item of items) {
    if (toEnqueue.length >= COLD_START_LLM_ENQUEUE_LIMIT) {
      break
    }
    if (!shouldRequestLlmMemoryEnrichment(item)) {
      continue
    }
    toEnqueue.push(item.id)
  }

  if (toEnqueue.length === 0) {
    logger.info('ColdStart', 'LLM 尽力入队', { scanned: items.length, enqueued: 0 })
    return 0
  }

  const batchId = `cold-start-llm-${Date.now()}`
  await beginColdStartEnrichmentBatch({ batchId, total: toEnqueue.length })
  for (const itemId of toEnqueue) {
    scheduleAsyncMemoryLlmEnrichment(itemId, { coldStartBatchId: batchId })
  }
  logger.info('ColdStart', 'LLM 尽力入队', {
    scanned: items.length,
    enqueued: toEnqueue.length,
    batchId
  })
  return toEnqueue.length
}

async function runAiBestEffortStage(): Promise<ColdStartReleaseReason> {
  const session = await getAuthSession()
  const isLoggedIn = Boolean(session?.accessToken)

  await patchState({
    status: 'running',
    stage: 'ai',
    version: COLD_START_PIPELINE_VERSION
  })

  // 未登录：Worker enrichment 走 IP 日配额（无须 Bearer）；embed 仍须登录
  const llmEnqueued = await enqueueColdStartLlmEnrichment()

  let embedAttempted = 0
  let embedWritten = 0
  if (isLoggedIn) {
    const embedResult = await runSilentMemoryEmbeddingMaintenance('cold_start')
    embedAttempted = embedResult?.attempted ?? 0
    embedWritten = embedResult?.written ?? 0
  } else {
    logger.info('ColdStart', '未登录：跳过 embed，尽力 LLM enrichment（IP 配额）', {
      llmEnqueued
    })
  }

  await patchState({
    status: 'running',
    stage: 'ai',
    version: COLD_START_PIPELINE_VERSION,
    aiEmbedAttempted: embedAttempted,
    aiEmbedWritten: embedWritten,
    aiLlmEnqueued: llmEnqueued
  })

  if (!isLoggedIn) {
    if (llmEnqueued === 0) {
      return 'local_ready'
    }
    await waitAiBurstWindow(llmEnqueued)
    return 'local_ready'
  }

  if (embedAttempted === 0 && llmEnqueued === 0) {
    return 'ai_skipped_empty'
  }

  const units = embedAttempted + llmEnqueued
  const waitMs = Math.min(
    COLD_START_AI_BEST_EFFORT_TIMEOUT_MS,
    Math.max(COLD_START_AI_MIN_BURST_MS, units * 400)
  )
  logger.info('ColdStart', 'AI 尽力短窗等待', { waitMs, units })
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    await sleep(500)
  }

  return waitMs >= COLD_START_AI_BEST_EFFORT_TIMEOUT_MS ? 'ai_best_effort_timeout' : 'completed'
}

async function waitAiBurstWindow(units: number): Promise<void> {
  const waitMs = Math.min(
    COLD_START_AI_BEST_EFFORT_TIMEOUT_MS,
    Math.max(COLD_START_AI_MIN_BURST_MS, units * 400)
  )
  logger.info('ColdStart', 'AI 尽力短窗等待', { waitMs, units })
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    await sleep(500)
  }
}

/**
 * 执行冷启动 pipeline（幂等单飞）。
 * 已 ready → 直接返回；存量可迁移 → 不弹门禁。
 */
export async function runColdStartPipeline(): Promise<ColdStartPipelineState> {
  if (pipelineInFlight) {
    return pipelineInFlight
  }

  pipelineInFlight = (async () => {
    const startedAt = flowStart('ColdStart', '冷启动 pipeline')
    try {
      const migrated = await migrateExistingIfEligible()
      if (migrated?.status === 'ready') {
        // 门禁跳过，但规则/embed 缺口仍静默补
        void ensureMemoryEnrichmentBackfilled().catch(error => {
          logger.error('ColdStart', '存量迁移后规则回填失败', error)
        })
        scheduleSilentMemoryEmbeddingMaintenance('cold_start_migrated', 2800)
        flowOk('ColdStart', '冷启动 pipeline', startedAt, {
          releaseReason: migrated.releaseReason ?? 'migrated_existing'
        })
        return migrated
      }

      const current = await readColdStartPipelineState()
      if (current?.status === 'ready' && current.version >= COLD_START_PIPELINE_VERSION) {
        scheduleSilentMemoryEmbeddingMaintenance('cold_start_already_ready', 2800)
        flowOk('ColdStart', '冷启动 pipeline', startedAt, { releaseReason: current.releaseReason })
        return current
      }

      // 尽早落盘 running，避免 Side Panel 在 import 写出前看不到门禁
      await patchState({
        status: 'running',
        stage: 'idle',
        version: COLD_START_PIPELINE_VERSION,
        startedAt: new Date().toISOString()
      })

      const settings = await getUserSettings()
      if (!settings.chromeBookmarkIngestEnabled) {
        await patchState({
          status: 'running',
          stage: 'rules',
          version: COLD_START_PIPELINE_VERSION,
          startedAt: new Date().toISOString()
        })
        await runRulesStage()
        await runAiBestEffortStage()
        const ready = await markReady('ingest_disabled')
        flowOk('ColdStart', '冷启动 pipeline', startedAt, {
          releaseReason: ready.releaseReason,
          ingestDisabled: true
        })
        return ready
      }

      const importOutcome = await runImportStage()
      if (importOutcome.failed) {
        logger.warn('ColdStart', '导入失败，仍尝试规则/AI 后放行', {
          error: importOutcome.error ?? null
        })
        try {
          await runRulesStage()
          await runAiBestEffortStage()
        } catch (innerError) {
          logger.warn('ColdStart', '导入失败后的规则/AI 补救异常', {
            error: innerError instanceof Error ? innerError.message : String(innerError)
          })
        }
        const ready = await markReady('import_failed', {
          ...(importOutcome.error ? { error: importOutcome.error } : {})
        })
        flowOk('ColdStart', '冷启动 pipeline', startedAt, { releaseReason: 'import_failed' })
        return ready
      }

      await runRulesStage()
      const aiReason = await runAiBestEffortStage()
      const ready = await markReady(aiReason)
      flowOk('ColdStart', '冷启动 pipeline', startedAt, {
        releaseReason: ready.releaseReason,
        aiEmbedWritten: ready.aiEmbedWritten,
        aiLlmEnqueued: ready.aiLlmEnqueued
      })
      return ready
    } catch (error) {
      flowFail('ColdStart', '冷启动 pipeline', startedAt, error)
      stopImportProgressPolling()
      return markReady('import_failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      stopImportProgressPolling()
      pipelineInFlight = null
    }
  })()

  return pipelineInFlight
}

/** 延迟调度冷启动 pipeline（bootstrap 用）。 */
export function scheduleColdStartPipeline(delayMs = COLD_START_PIPELINE_START_DELAY_MS): void {
  logger.info('ColdStart', '已调度冷启动 pipeline', { delayMs })
  setTimeout(() => {
    void runColdStartPipeline().catch(error => {
      logger.error('ColdStart', '冷启动 pipeline 失败', error)
    })
  }, delayMs)
}

/** 测试用：重置单飞与进度轮询。 */
export function resetColdStartPipelineForTests(): void {
  stopImportProgressPolling()
  pipelineInFlight = null
}
