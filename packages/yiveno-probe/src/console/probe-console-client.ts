/**
 * Probe Console → Background（造数 / 清理 / 批量跑分相关 DEV 消息）。
 * 故意不依赖 extension background-client；消息 type 与扩展 DEV 契约对齐。
 */

import type { ProbeSeedPayload } from '../presets/seed-presets'

type FailResponse = {
  ok: false
  errorCode?: string
  error?: string
}

export type ProbeSeedRecallResponse =
  | {
      ok: true
      persona: string[]
      bookmarkCount: number
      excerptCount: number
      diversityBookmarkCount: number
      diversityExcerptCount: number
      noiseBookmarkCount: number
      noiseExcerptCount: number
      chromeBookmarkSync: 'all' | 'curated_only'
      indexRebuilt: boolean
      wipedChromeFolders: number
      clearedMemoryCount: number
      probeKeys: string[]
      mappedCount: number
    }
  | FailResponse

export type ProbeCleanupPayload = {
  /** 清噪声 / 多样性层 */
  noiseOrDiversity?: boolean
  /** 清精选探针 */
  curatedProbe?: boolean
  /** 清当前 owner 全部 Memory */
  allMemory?: boolean
  /** 类型过滤 */
  types?: 'all' | 'bookmark' | 'text_excerpt'
  /** 移除 Chrome「Yiveno Probe」文件夹 */
  removeProbeFolder?: boolean
  /** 清空 Chrome 书签根下全部子树 */
  wipeChromeBookmarkChildren?: boolean
}

export type ProbeCleanupResponse =
  | {
      ok: true
      scannedCount: number
      purgedExcerptCount: number
      purgedBookmarkCount: number
      keptCount: number
      removedChromeProbeFolder: boolean
      removedChromeBookmarkNodes: number
      wipedChromeFolders: number
      clearedAllMemory: boolean
      indexRebuilt: boolean
    }
  | FailResponse

export type ProbeBatchCaseRow = {
  caseId: string
  clue: string
  expectedKey: string
  expectedId: string | null
  persona: string
  source: 'curated' | 'diversity'
  kind: 'bookmark' | 'excerpt'
  label: string
  verdict: 'top1' | 'in_topk' | 'miss' | 'unmapped' | 'error'
  actualTop1Title: string | null
  latencyMs: number
  error?: string
}

export type ProbeBatchAggregatesView = {
  total: number
  judged: number
  top1Count: number
  inTopkCount: number
  missCount: number
  unmappedCount: number
  errorCount: number
  top1Rate: number
  inTop3Rate: number
  missRate: number
  byPersona: Record<
    string,
    {
      total: number
      top1: number
      in_topk: number
      miss: number
      unmapped: number
      error: number
    }
  >
  bySource: Record<
    string,
    {
      total: number
      top1: number
      in_topk: number
      miss: number
      unmapped: number
      error: number
    }
  >
  latencyMs: { p50: number; p95: number }
}

export type ProbeBatchReportView = {
  recipeId: string
  fillerSeed: number
  startedAtIso: string
  finishedAtIso: string
  cases: ProbeBatchCaseRow[]
  aggregates: ProbeBatchAggregatesView
}

export type ProbeRunBatchPayload = {
  recipeId?: string
  fillerSeed?: number
  personas?: ProbeSeedPayload['personas']
  diversityBookmarkCount?: number
  diversityExcerptCount?: number
}

export type ProbeRunBatchResponse =
  { ok: true; runId: string; report: ProbeBatchReportView } | FailResponse

export type ProbeBatchProgressView = {
  runId: string
  phase: 'running' | 'done' | 'error'
  current: number
  total: number
  lastClue?: string
  updatedAtIso: string
  error?: string
}

export type ProbeBatchProgressResponse =
  { ok: true; progress: ProbeBatchProgressView | null } | FailResponse

export type ProbeRunHistorySummary = {
  runId: string
  recipeId: string
  fillerSeed: number
  startedAtIso: string
  finishedAtIso: string
  total: number
  top1Rate: number
  inTop3Rate: number
  missRate: number
  unmappedCount: number
  latencyP50: number
  latencyP95: number
}

export type ProbeListRunsResponse = { ok: true; runs: ProbeRunHistorySummary[] } | FailResponse

export type ProbeGetRunResponse =
  { ok: true; runId: string; report: ProbeBatchReportView } | FailResponse

export type ProbeDiffRow = {
  metric: string
  before: number
  after: number
  delta: number
}

export type ProbeDiffRunsResponse =
  | {
      ok: true
      beforeRunId: string
      afterRunId: string
      rows: ProbeDiffRow[]
    }
  | FailResponse

async function sendProbeMessage<T>(message: {
  scope: 'background'
  type: string
  payload?: unknown
}): Promise<T> {
  try {
    const response = await chrome.runtime.sendMessage(message)
    if (response === undefined) {
      return {
        ok: false,
        errorCode: 'MESSAGE_DISPATCH_FAILED',
        error: 'Background 无响应'
      } as T
    }
    return response as T
  } catch (error) {
    return {
      ok: false,
      errorCode: 'MESSAGE_DISPATCH_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    } as T
  }
}

export async function probeSeedRecall(
  payload?: Partial<ProbeSeedPayload>
): Promise<ProbeSeedRecallResponse> {
  if (payload === undefined) {
    return sendProbeMessage({
      scope: 'background',
      type: 'DEV_SEED_RECALL_PROBE'
    })
  }
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_SEED_RECALL_PROBE',
    payload
  })
}

/** 按选项批量清理（DEV_PROBE_CLEANUP）。 */
export async function probeCleanup(payload: ProbeCleanupPayload): Promise<ProbeCleanupResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_PROBE_CLEANUP',
    payload
  })
}

/** 数据驱动批量探针跑分。 */
export async function probeRunBatch(
  payload?: ProbeRunBatchPayload
): Promise<ProbeRunBatchResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_RUN_PROBE_BATCH',
    ...(payload !== undefined ? { payload } : {})
  })
}

/** 批量跑分进度。 */
export async function probeGetBatchProgress(): Promise<ProbeBatchProgressResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_GET_PROBE_BATCH_PROGRESS'
  })
}

/** 运行历史摘要列表。 */
export async function probeListRuns(): Promise<ProbeListRunsResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_LIST_PROBE_RUNS'
  })
}

/** 读取单次运行报告。 */
export async function probeGetRun(runId: string): Promise<ProbeGetRunResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_GET_PROBE_RUN',
    payload: { runId }
  })
}

/** 两次运行指标 diff。 */
export async function probeDiffRuns(
  beforeRunId: string,
  afterRunId: string
): Promise<ProbeDiffRunsResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_DIFF_PROBE_RUNS',
    payload: { beforeRunId, afterRunId }
  })
}
