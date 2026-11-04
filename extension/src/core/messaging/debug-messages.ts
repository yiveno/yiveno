/**
 * DEV 召回探针消息（仅 import.meta.env.DEV 受理）。
 * 用于本地种书签/摘录/附注语料，禁止生产路径调用。
 */

import { z } from 'zod'

import type { BackgroundMessageScope } from '@/core/messaging/constants'

export const RecallProbePersonaSchema = z.enum([
  'researcher', // 跨来源研究者（首发优先）
  'creator', // 创作者 / 设计研究者
  'developer', // 开发者 / PM
  'student', // 学生 / 终身学习者（扩展覆盖；默认种库不含）
  'knowledge_worker' // 知识工作者 / 非工程职场（扩展覆盖；默认种库不含）
])

const seedRecallProbePayloadSchema = z.object({
  /** 要种入的画像；默认仍为质量轮三画像（扩展画像须显式传入）。 */
  personas: z
    .array(RecallProbePersonaSchema)
    .min(1)
    .max(5)
    .default(['researcher', 'creator', 'developer']),
  /**
   * true：清空当前 owner 的 Memory + 清空 Chrome 书签栏下全部子树，再种语料。
   * 不经 CLEAR_LOCAL_MEMORY（避免顺带关灌库/同步）。
   */
  replace: z.boolean().default(true),
  /** 噪声书签（邻域填充；质量轮默认偏高；压力轮可至万级）。 */
  noiseBookmarkCount: z.number().int().min(0).max(15000).default(400),
  /** 噪声摘录。 */
  noiseExcerptCount: z.number().int().min(0).max(8000).default(150),
  /** 画像风味多样性书签（非精选、可含少量附注探针）。 */
  diversityBookmarkCount: z.number().int().min(0).max(12000).default(350),
  /** 画像风味多样性摘录。 */
  diversityExcerptCount: z.number().int().min(0).max(8000).default(150),
  /** 每画像混淆组书签组数（缺省 0）。 */
  clusterBookmarkCount: z.number().int().min(0).max(200).default(0),
  /** 每画像混淆组摘录组数（缺省 0）。 */
  clusterExcerptCount: z.number().int().min(0).max(200).default(0),
  /**
   * 书签写入 Chrome 的范围。
   * - all：精选 + 多样性 + 噪声均写 Chrome（质量轮；万级极慢）
   * - curated_only：仅精选写 Chrome；多样性/噪声直写 Memory（压力轮 ~20k）
   */
  chromeBookmarkSync: z.enum(['all', 'curated_only']).default('all'),
  /**
   * 是否对精选条调度 LLM enrichment（烧配额；质量轮默认开）。
   * 噪声 / 多样性条永不调度。
   */
  enrichCurated: z.boolean().default(true),
  /**
   * diversity / noise 过程随机种子（可复现）。
   * 缺省由 seeder 使用包内 DEFAULT_PROBE_FILLER_SEED。
   */
  fillerSeed: z.number().int().min(0).max(0xffff_ffff).optional(),
  /**
   * 可选配方 id（Probe Console 写入；写入 key→id 映射的 seedContext，供 runner 历史对账）。
   */
  recipeId: z.string().min(1).max(120).optional()
})

export type SeedRecallProbePayload = z.infer<typeof seedRecallProbePayloadSchema>

/** DEV：种入召回探针语料。 */
export type DevSeedRecallProbeMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_SEED_RECALL_PROBE'
  payload?: Partial<SeedRecallProbePayload>
}

export type DevSeedRecallProbeResponse =
  | {
      ok: true
      persona: string[]
      bookmarkCount: number
      excerptCount: number
      diversityBookmarkCount: number
      diversityExcerptCount: number
      noiseBookmarkCount: number
      noiseExcerptCount: number
      clusterBookmarkCount: number
      clusterExcerptCount: number
      chromeBookmarkSync: 'all' | 'curated_only'
      indexRebuilt: boolean
      wipedChromeFolders: number
      clearedMemoryCount: number
      probeKeys: string[]
      /** 全量 key→id 映射条数（精选 + diversity + noise + cluster） */
      mappedCount: number
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_SEED_FAILED' // DEV_ONLY=生产构建拒绝；DEV_SEED_FAILED=种入异常
      error?: string
    }

/** DEV：清除探针噪声 / 多样性层（保留精选语料）。 */
export type DevPurgeProbeNoiseMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_PURGE_PROBE_NOISE'
}

export type DevPurgeProbeNoiseResponse =
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
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PURGE_FAILED' // DEV_ONLY=生产构建拒绝；DEV_PURGE_FAILED=清除异常
      error?: string
    }

const probeCleanupPayloadSchema = z
  .object({
    /** 清噪声 / 多样性层 */
    noiseOrDiversity: z.boolean().default(false),
    /** 清精选探针（语料 URL / yiveno-probe / Chrome Probe 文件夹内书签） */
    curatedProbe: z.boolean().default(false),
    /** 清当前 owner 全部 Memory（优先于上两层） */
    allMemory: z.boolean().default(false),
    /** 类型过滤 */
    types: z.enum(['all', 'bookmark', 'text_excerpt']).default('all'),
    /** 移除种库主题文件夹（含历史「Yiveno Probe」；wipe 开启时可不设） */
    removeProbeFolder: z.boolean().default(false),
    /** 清空 Chrome 各书签根下全部子树（危险；整库清理常用） */
    wipeChromeBookmarkChildren: z.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    if (!value.allMemory && !value.noiseOrDiversity && !value.curatedProbe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '须至少选择 noiseOrDiversity / curatedProbe / allMemory 之一'
      })
    }
  })

export type ProbeCleanupPayload = z.infer<typeof probeCleanupPayloadSchema>

/** DEV：按选项批量清理探针 / Memory。 */
export type DevProbeCleanupMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_PROBE_CLEANUP'
  payload: Partial<ProbeCleanupPayload>
}

export type DevProbeCleanupResponse = DevPurgeProbeNoiseResponse

const backdateMemorySavedAtPayloadSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    /** 相对今天 UTC 正午回溯天数；与 savedAtIso 二选一 */
    daysAgo: z.number().int().min(0).max(3650).optional(),
    /** 绝对 ISO datetime；与 daysAgo 二选一 */
    savedAtIso: z.string().datetime().optional()
  })
  .refine(
    value =>
      (value.daysAgo !== undefined && value.savedAtIso === undefined) ||
      (value.daysAgo === undefined && value.savedAtIso !== undefined),
    { message: '须指定 daysAgo 或 savedAtIso 之一，且不可同时指定' }
  )

export type BackdateMemorySavedAtPayload = z.infer<typeof backdateMemorySavedAtPayloadSchema>

/** DEV：回溯 MemoryItem 保存时刻（TTE 冷却手测）。 */
export type DevBackdateMemorySavedAtMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_BACKDATE_MEMORY_SAVED_AT'
  payload: BackdateMemorySavedAtPayload
}

export type DevBackdateMemorySavedAtResponse =
  | {
      ok: true
      savedAtIso: string
      updated: Array<{ id: string; type: string; savedAtIso: string }>
      notFound: string[]
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_BACKDATE_FAILED'
      error?: string
    }

/** DEV：当前库盘点快照（Probe Console）。 */
export type DevProbeLibrarySnapshotMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_PROBE_LIBRARY_SNAPSHOT'
}

export type DevProbeLibrarySnapshotResponse =
  | {
      ok: true
      scannedCount: number
      truncated: boolean
      byType: { bookmark: number; text_excerpt: number; other: number }
      byLayer: { probe_noise_or_diversity: number; other: number }
      recentOther: Array<{
        id: string
        type: string
        title: string
        url: string
        notePreview: string | null
        savedAtIso: string
        layer: string
      }>
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_SNAPSHOT_FAILED'
      error?: string
    }

const listProbeFixturesPayloadSchema = z
  .object({
    personas: z.array(RecallProbePersonaSchema).min(1).max(5).optional()
  })
  .optional()

export type ListProbeFixturesPayload = z.infer<typeof listProbeFixturesPayloadSchema>

/** DEV：探针精选夹具目录（不写库）。 */
export type DevListProbeFixturesMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_LIST_PROBE_FIXTURES'
  payload?: ListProbeFixturesPayload
}

export type DevListProbeFixturesResponse =
  | {
      ok: true
      defaultPersonas: string[]
      personaOrder: string[]
      rows: Array<{
        persona: string
        kind: 'bookmark' | 'excerpt'
        key: string
        label: string
        clues: Array<{
          text: string
          type: 'verbatim' | 'paraphrase' | 'associative' | 'temporal' | 'note' | 'ambiguous'
        }>
      }>
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_FIXTURES_FAILED'
      error?: string
    }

/**
 * DEV：Cold Memory 影响量化报告（实验一·阶段五 · 2026-09-21）。
 * 读库盘点 > RECALL_SCAN_LIMIT 的条目比例与倒排覆盖。
 */
export type DevColdMemoryImpactMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_COLD_MEMORY_IMPACT'
}

export interface DevColdMemoryImpactBreakdown {
  bookmark: number
  text_excerpt: number
  other: number
}

export interface DevColdMemoryImpactLayer {
  probe_noise_or_diversity: number
  other: number
}

export type DevColdMemoryImpactResponse =
  | {
      ok: true
      totalCount: number
      probeTruncated: boolean
      beyondLimitCount: number
      beyondLimitRate: number
      indexedCount: number
      indexedRate: number
      beyondLimitIndexedCount: number
      beyondLimitIndexedRate: number
      oldestBeyondLimitIso: string | null
      newestBeyondLimitIso: string | null
      byType: DevColdMemoryImpactBreakdown
      byLayer: DevColdMemoryImpactLayer
      scanLimit: number
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_COLD_MEMORY_FAILED'
      error?: string
    }

/**
 * DEV：Cold Memory Latency 测量（阶段六 D · 2026-09-21）。
 * 假定库已 seed；测单次 listForKeywordRecall fallback 路径耗时。
 */
export type DevColdMemoryLatencyMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_COLD_MEMORY_LATENCY'
  payload?: { clue?: string }
}

export type DevColdMemoryLatencyResponse =
  | {
      ok: true
      seedSize: number
      recallLatencyMs: number
      itemsReturned: number
      recallSource: 'inverted' | 'scan'
      clue: string
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_COLD_MEMORY_LATENCY_FAILED'
      error?: string
    }

const runProbeBatchPayloadSchema = z.object({
  recipeId: z.string().min(1).max(120).optional(),
  fillerSeed: z.number().int().min(0).max(0xffff_ffff).optional(),
  personas: z.array(RecallProbePersonaSchema).min(1).max(5).optional(),
  diversityBookmarkCount: z.number().int().min(0).max(12000).optional(),
  diversityExcerptCount: z.number().int().min(0).max(8000).optional(),
  clusterBookmarkCount: z.number().int().min(0).max(200).optional(),
  clusterExcerptCount: z.number().int().min(0).max(200).optional(),
  includeNegatives: z.boolean().optional()
})

export type RunProbeBatchPayload = z.infer<typeof runProbeBatchPayloadSchema>

/** DEV：数据驱动批量探针跑分。 */
export type DevRunProbeBatchMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_RUN_PROBE_BATCH'
  payload?: RunProbeBatchPayload
}

/** 批量报告分组计数（消息面；optional 字段带 | undefined 以兼容 exactOptionalPropertyTypes）。 */
type ProbeBatchGroupStatsDto = {
  total: number
  top1: number
  in_topk: number
  miss: number
  unmapped: number
  error: number
  false_positive?: number | undefined
  rejected?: number | undefined
}

/** 批量报告 DTO（与 runner / history 读写共用）。 */
export type DevProbeBatchReportDto = {
  recipeId: string
  fillerSeed: number
  startedAtIso: string
  finishedAtIso: string
  cases: Array<{
    caseId: string
    clue: string
    clueType?: string | undefined
    expectedKey: string
    expectedId: string | null
    expectedIds?: string[] | undefined
    preferredId?: string | undefined
    clusterId?: string | undefined
    persona: string
    source: 'curated' | 'diversity' | 'cluster' | 'negative'
    kind: 'bookmark' | 'excerpt' | 'negative'
    label: string
    verdict: 'top1' | 'in_topk' | 'miss' | 'unmapped' | 'error' | 'false_positive' | 'rejected'
    actualTop1Title: string | null
    latencyMs: number
    error?: string | undefined
  }>
  aggregates: {
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
    byPersona: Record<string, ProbeBatchGroupStatsDto>
    bySource: Record<string, ProbeBatchGroupStatsDto>
    byClueType?: Record<string, ProbeBatchGroupStatsDto> | undefined
    clusters?:
      | {
          total: number
          anyHitCount: number
          preferredTop1Count: number
          anyHitRate: number
          preferredTop1Rate: number
        }
      | undefined
    negatives?:
      | {
          total: number
          falsePositiveCount: number
          rejectedCount: number
          falsePositiveRate: number
        }
      | undefined
    latencyMs: { p50: number; p95: number }
  }
}

export type DevRunProbeBatchResponse =
  | {
      ok: true
      runId: string
      report: DevProbeBatchReportDto
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PROBE_BATCH_FAILED'
      error?: string
    }

/** DEV：批量探针进度（Console 轮询）。 */
export type DevGetProbeBatchProgressMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_GET_PROBE_BATCH_PROGRESS'
}

export type DevGetProbeBatchProgressResponse =
  | {
      ok: true
      progress: {
        runId: string
        phase: 'running' | 'done' | 'error'
        current: number
        total: number
        lastClue?: string | undefined
        updatedAtIso: string
        error?: string | undefined
      } | null
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PROBE_BATCH_PROGRESS_FAILED'
      error?: string
    }

/** DEV：列出探针运行历史摘要。 */
export type DevListProbeRunsMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_LIST_PROBE_RUNS'
}

export type DevListProbeRunsResponse =
  | {
      ok: true
      runs: Array<{
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
      }>
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PROBE_RUNS_FAILED'
      error?: string
    }

const getProbeRunPayloadSchema = z.object({
  runId: z.string().min(1).max(200)
})

export type GetProbeRunPayload = z.infer<typeof getProbeRunPayloadSchema>

/** DEV：读取单次运行完整报告。 */
export type DevGetProbeRunMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_GET_PROBE_RUN'
  payload: GetProbeRunPayload
}

export type DevGetProbeRunResponse =
  | {
      ok: true
      runId: string
      report: Extract<DevRunProbeBatchResponse, { ok: true }>['report']
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PROBE_RUN_NOT_FOUND' | 'DEV_PROBE_RUNS_FAILED'
      error?: string
    }

const diffProbeRunsPayloadSchema = z.object({
  beforeRunId: z.string().min(1).max(200),
  afterRunId: z.string().min(1).max(200)
})

export type DiffProbeRunsPayload = z.infer<typeof diffProbeRunsPayloadSchema>

/** DEV：两次运行聚合指标 diff。 */
export type DevDiffProbeRunsMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_DIFF_PROBE_RUNS'
  payload: DiffProbeRunsPayload
}

export type DevDiffProbeRunsResponse =
  | {
      ok: true
      beforeRunId: string
      afterRunId: string
      rows: Array<{
        metric: string
        before: number
        after: number
        delta: number
      }>
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PROBE_RUN_NOT_FOUND' | 'DEV_PROBE_DIFF_FAILED'
      error?: string
    }

export type DebugBackgroundMessage =
  | DevSeedRecallProbeMessage
  | DevPurgeProbeNoiseMessage
  | DevProbeCleanupMessage
  | DevBackdateMemorySavedAtMessage
  | DevProbeLibrarySnapshotMessage
  | DevListProbeFixturesMessage
  | DevColdMemoryImpactMessage
  | DevColdMemoryLatencyMessage
  | DevRunProbeBatchMessage
  | DevGetProbeBatchProgressMessage
  | DevListProbeRunsMessage
  | DevGetProbeRunMessage
  | DevDiffProbeRunsMessage
export type DebugBackgroundResponse =
  | DevSeedRecallProbeResponse
  | DevPurgeProbeNoiseResponse
  | DevProbeCleanupResponse
  | DevBackdateMemorySavedAtResponse
  | DevProbeLibrarySnapshotResponse
  | DevListProbeFixturesResponse
  | DevColdMemoryImpactResponse
  | DevColdMemoryLatencyResponse
  | DevRunProbeBatchResponse
  | DevGetProbeBatchProgressResponse
  | DevListProbeRunsResponse
  | DevGetProbeRunResponse
  | DevDiffProbeRunsResponse

export function parseSeedRecallProbePayload(value: unknown): SeedRecallProbePayload {
  return seedRecallProbePayloadSchema.parse(value ?? {})
}

export function parseProbeCleanupPayload(value: unknown): ProbeCleanupPayload {
  return probeCleanupPayloadSchema.parse(value ?? {})
}

export function parseBackdateMemorySavedAtPayload(value: unknown): BackdateMemorySavedAtPayload {
  return backdateMemorySavedAtPayloadSchema.parse(value)
}

export function parseListProbeFixturesPayload(value: unknown): ListProbeFixturesPayload {
  return listProbeFixturesPayloadSchema.parse(value ?? {})
}

export function parseRunProbeBatchPayload(value: unknown): RunProbeBatchPayload {
  return runProbeBatchPayloadSchema.parse(value ?? {})
}

export function parseGetProbeRunPayload(value: unknown): GetProbeRunPayload {
  return getProbeRunPayloadSchema.parse(value)
}

export function parseDiffProbeRunsPayload(value: unknown): DiffProbeRunsPayload {
  return diffProbeRunsPayloadSchema.parse(value)
}
