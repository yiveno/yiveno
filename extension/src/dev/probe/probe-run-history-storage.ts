/**
 * DEV-only：探针批量运行历史（chrome.storage.local）。
 * 键按 recipeId + fillerSeed + 时间戳；供 Console 列表与 diff。
 * M2 新字段一律 optional，历史键不升版，兼容 M1 记录。
 */

import { z } from 'zod'

import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'
import { logger } from '@/infrastructure/logging/logger'
import type { ProbeBatchReport } from '@yiveno/probe'

export const PROBE_RUN_HISTORY_STORAGE_KEY = 'yiveno.dev.probeRunHistory.v1'

/** 历史条数上限（环形裁剪）。 */
const MAX_RUNS = 40

const groupStatsSchema = z.object({
  total: z.number().int().min(0),
  top1: z.number().int().min(0),
  in_topk: z.number().int().min(0),
  miss: z.number().int().min(0),
  unmapped: z.number().int().min(0),
  error: z.number().int().min(0),
  // default(0)：M1 记录缺字段时补齐，读回类型为 number
  false_positive: z.number().int().min(0).default(0),
  rejected: z.number().int().min(0).default(0)
})

const aggregatesSchema = z.object({
  total: z.number().int().min(0),
  judged: z.number().int().min(0),
  top1Count: z.number().int().min(0),
  inTopkCount: z.number().int().min(0),
  missCount: z.number().int().min(0),
  unmappedCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  top1Rate: z.number(),
  inTop3Rate: z.number(),
  missRate: z.number(),
  byPersona: z.record(z.string(), groupStatsSchema),
  bySource: z.record(z.string(), groupStatsSchema),
  byClueType: z.record(z.string(), groupStatsSchema).optional(),
  clusters: z
    .object({
      total: z.number().int().min(0),
      anyHitCount: z.number().int().min(0),
      preferredTop1Count: z.number().int().min(0),
      anyHitRate: z.number(),
      preferredTop1Rate: z.number()
    })
    .optional(),
  negatives: z
    .object({
      total: z.number().int().min(0),
      falsePositiveCount: z.number().int().min(0),
      rejectedCount: z.number().int().min(0),
      falsePositiveRate: z.number()
    })
    .optional(),
  latencyMs: z.object({
    p50: z.number(),
    p95: z.number()
  })
})

const caseResultSchema = z.object({
  caseId: z.string(),
  clue: z.string(),
  clueType: z
    .enum(['verbatim', 'paraphrase', 'associative', 'temporal', 'note', 'ambiguous'])
    .optional(),
  expectedKey: z.string(),
  expectedId: z.string().nullable(),
  expectedIds: z.array(z.string()).optional(),
  preferredId: z.string().optional(),
  clusterId: z.string().optional(),
  persona: z.string(),
  source: z.enum(['curated', 'diversity', 'cluster', 'negative']),
  kind: z.enum(['bookmark', 'excerpt', 'negative']),
  label: z.string(),
  verdict: z.enum(['top1', 'in_topk', 'miss', 'unmapped', 'error', 'false_positive', 'rejected']),
  actualTop1Title: z.string().nullable(),
  latencyMs: z.number(),
  error: z.string().optional()
})

const reportSchema = z.object({
  recipeId: z.string(),
  fillerSeed: z.number().int(),
  startedAtIso: z.string(),
  finishedAtIso: z.string(),
  cases: z.array(caseResultSchema),
  aggregates: aggregatesSchema
})

const runRecordSchema = z.object({
  /** `${recipeId}__${fillerSeed}__${timestampMs}` */
  runId: z.string(),
  recipeId: z.string(),
  fillerSeed: z.number().int(),
  startedAtIso: z.string(),
  finishedAtIso: z.string(),
  report: reportSchema
})

const historyStoreSchema = z.object({
  version: z.literal(1),
  runs: z.array(runRecordSchema).max(MAX_RUNS)
})

export type ProbeRunRecord = z.infer<typeof runRecordSchema>
export type ProbeRunHistoryStore = z.infer<typeof historyStoreSchema>

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

function toSummary(run: ProbeRunRecord): ProbeRunHistorySummary {
  return {
    runId: run.runId,
    recipeId: run.recipeId,
    fillerSeed: run.fillerSeed,
    startedAtIso: run.startedAtIso,
    finishedAtIso: run.finishedAtIso,
    total: run.report.aggregates.total,
    top1Rate: run.report.aggregates.top1Rate,
    inTop3Rate: run.report.aggregates.inTop3Rate,
    missRate: run.report.aggregates.missRate,
    unmappedCount: run.report.aggregates.unmappedCount,
    latencyP50: run.report.aggregates.latencyMs.p50,
    latencyP95: run.report.aggregates.latencyMs.p95
  }
}

async function readStore(): Promise<ProbeRunHistoryStore> {
  const stored = await readChromeStorageLocal(PROBE_RUN_HISTORY_STORAGE_KEY, historyStoreSchema)
  if (stored) {
    return stored
  }
  return { version: 1, runs: [] }
}

/** 构造 runId：配方 + fillerSeed + 时间戳。 */
export function buildProbeRunId(input: {
  recipeId: string
  fillerSeed: number
  startedAtMs: number
}): string {
  const safeRecipe = input.recipeId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'recipe'
  return `${safeRecipe}__${input.fillerSeed}__${input.startedAtMs}`
}

export async function appendProbeRunRecord(report: ProbeBatchReport): Promise<ProbeRunRecord> {
  const startedAtMs = Date.parse(report.startedAtIso) || Date.now()
  const runId = buildProbeRunId({
    recipeId: report.recipeId,
    fillerSeed: report.fillerSeed,
    startedAtMs
  })
  const record: ProbeRunRecord = {
    runId,
    recipeId: report.recipeId,
    fillerSeed: report.fillerSeed,
    startedAtIso: report.startedAtIso,
    finishedAtIso: report.finishedAtIso,
    report
  }
  const store = await readStore()
  const nextRuns = [record, ...store.runs.filter(item => item.runId !== runId)].slice(0, MAX_RUNS)
  await writeChromeStorageLocal(PROBE_RUN_HISTORY_STORAGE_KEY, {
    version: 1 as const,
    runs: nextRuns
  })
  logger.info('DevProbe', '已持久化探针运行记录', {
    runId,
    total: report.aggregates.total,
    top1Rate: report.aggregates.top1Rate
  })
  return record
}

export async function listProbeRunHistorySummaries(): Promise<ProbeRunHistorySummary[]> {
  const store = await readStore()
  return store.runs.map(toSummary)
}

export async function getProbeRunRecord(runId: string): Promise<ProbeRunRecord | null> {
  const store = await readStore()
  return store.runs.find(run => run.runId === runId) ?? null
}

/** 供单测：解析 report（含 M2 新字段）是否被 schema 保留。 */
export function parseProbeBatchReportForStorage(report: unknown): ProbeBatchReport {
  return reportSchema.parse(report) as ProbeBatchReport
}
