import { z } from 'zod'

import {
  shouldShowColdStartEnrichmentBatchProgress,
  type ColdStartEnrichmentBatch
} from '@/core/memory/cold-start-enrichment-batch'

/** 冷启动三阶段门禁状态（chrome.storage.local）。 */
export const COLD_START_PIPELINE_STORAGE_KEY = 'yiveno.coldStartPipeline' as const

/**
 * 冷启动契约版本。阶段语义大变时递增，触发再跑（存量迁移策略见 pipeline service）。
 */
export const COLD_START_PIPELINE_VERSION = 1

/** 当前所处阶段。 */
export const ColdStartStageSchema = z.enum([
  'idle', // 未开始
  'import', // 导入 Chrome 书签原料
  'rules', // 本地规则 enrichment 全量
  'ai', // embed + LLM 尽力
  'done' // 已放行（含 best-effort / 迁移）
])

export type ColdStartStage = z.infer<typeof ColdStartStageSchema>

/** 放行原因（调试 + UI 弱提示；超时等为占位可调）。 */
export const ColdStartReleaseReasonSchema = z.enum([
  'completed', // 已登录且 AI 尽力短窗走完
  'local_ready', // 未登录：import+规则本地质量门禁完成（产品：本地可用无须登录）
  'ai_best_effort_timeout', // AI 阶段占位超时后放行
  'ai_skipped_no_auth', // 兼容旧落盘；语义同 local_ready
  'ai_skipped_empty', // 已登录但无需 AI 补齐
  'import_failed', // 导入失败仍放行，避免卡死
  'migrated_existing', // 存量用户已完成导入，不重弹门禁
  'ingest_disabled' // 用户关闭书签灌库
])

export type ColdStartReleaseReason = z.infer<typeof ColdStartReleaseReasonSchema>

export const ColdStartPipelineStateSchema = z.object({
  version: z.number().int().positive(),
  status: z.enum([
    'pending', // 待跑
    'running', // 进行中（门禁应展示）
    'ready', // 已放行
    'failed' // 硬失败（少见；仍可带 releaseReason 放行）
  ]),
  stage: ColdStartStageSchema,
  /** 书签导入子进度。 */
  importImportedCount: z.number().int().nonnegative(),
  importTotalCount: z.number().int().nonnegative().optional(),
  /** 规则 enrichment 子进度。 */
  rulesScanned: z.number().int().nonnegative(),
  rulesUpdated: z.number().int().nonnegative(),
  /** AI 尽力子进度（占位可调）。 */
  aiEmbedAttempted: z.number().int().nonnegative(),
  aiEmbedWritten: z.number().int().nonnegative(),
  aiLlmEnqueued: z.number().int().nonnegative(),
  releaseReason: ColdStartReleaseReasonSchema.optional(),
  startedAt: z.string().datetime().optional(),
  readyAt: z.string().datetime().optional(),
  /** 调试用；UI 不得作为主文案。 */
  error: z.string().optional()
})

export type ColdStartPipelineState = z.infer<typeof ColdStartPipelineStateSchema>

/** 是否应展示 Side Panel 全屏门禁。 */
export function shouldShowColdStartGate(state: ColdStartPipelineState | null): boolean {
  if (!state) {
    return false
  }
  return state.status === 'running' || state.status === 'pending'
}

/**
 * 综合进度 0–100（阶段权重占位：import 40 / rules 30 / ai 30）。
 * AI 阶段在超时前可不到 100；ready 时恒为 100。
 */
export function getColdStartOverallPercent(state: ColdStartPipelineState): number {
  if (state.status === 'ready' || state.stage === 'done') {
    return 100
  }

  if (state.stage === 'idle' || state.status === 'pending') {
    return 0
  }

  if (state.stage === 'import') {
    const total = state.importTotalCount
    if (!total || total <= 0) {
      return 5
    }
    return Math.min(40, Math.round((state.importImportedCount / total) * 40))
  }

  if (state.stage === 'rules') {
    // 规则阶段多为整库扫描；无细粒度时落在区间中部
    if (state.rulesScanned > 0) {
      return 55
    }
    return 42
  }

  if (state.stage === 'ai') {
    const written = state.aiEmbedWritten
    const attempted = state.aiEmbedAttempted
    if (attempted > 0) {
      return Math.min(99, 70 + Math.round((written / attempted) * 25))
    }
    if (state.aiLlmEnqueued > 0) {
      return 78
    }
    return 72
  }

  return 0
}

/** 放行后轻条默认可见窗口（自 readyAt 起）。 */
export const COLD_START_POST_RELEASE_BANNER_TTL_MS = 5 * 60_000

/** 不展示「后台加厚」轻条的放行原因（无未完成尽力工作）。 */
const POST_RELEASE_BANNER_SKIP_REASONS = new Set<ColdStartReleaseReason>([
  'migrated_existing', // 存量跳过门禁
  'ingest_disabled', // 未灌书签
  'ai_skipped_empty', // 无需 AI 补齐
  'import_failed' // 导入失败放行；另有 import 错误条
])

export type ShouldShowColdStartPostReleaseBannerInput = {
  state: ColdStartPipelineState | null
  /** 当前时间（ms）；可注入便于单测。 */
  nowMs: number
  /** 本会话已对应该次 readyAt 点过关闭。 */
  dismissedReadyAt?: string | null
  /** 覆盖默认 TTL（测试用）。 */
  ttlMs?: number
  /**
   * 本轮冷启动 LLM enrichment 批次进度。
   * 有进行中/配额暂停批时优先据此展示（真实进度条）。
   */
  enrichmentBatch?: ColdStartEnrichmentBatch | null
}

/**
 * 门禁已放行、主壳可用，但 LLM 尽力可能仍在后台时，展示非阻挡轻条。
 * 禁止挡 Recall；批次完成 / 关闭 / TTL 后消失。
 */
export function shouldShowColdStartPostReleaseBanner(
  input: ShouldShowColdStartPostReleaseBannerInput
): boolean {
  const { state, nowMs, dismissedReadyAt = null, enrichmentBatch = null } = input
  if (!state || state.status !== 'ready' || state.stage !== 'done') {
    return false
  }

  const readyAt = state.readyAt
  if (!readyAt) {
    return false
  }

  if (dismissedReadyAt && dismissedReadyAt === readyAt) {
    return false
  }

  const readyMs = Date.parse(readyAt)
  if (!Number.isFinite(readyMs)) {
    return false
  }

  const reason = state.releaseReason
  if (reason && POST_RELEASE_BANNER_SKIP_REASONS.has(reason)) {
    return false
  }

  // 有真实批次进度：进行中或配额暂停 → 展示（完成即隐，不靠 TTL 砍条）
  if (enrichmentBatch) {
    if (shouldShowColdStartEnrichmentBatchProgress(enrichmentBatch)) {
      return true
    }
    if (
      enrichmentBatch.status === 'completed' ||
      enrichmentBatch.status === 'cleared' ||
      (enrichmentBatch.total > 0 && enrichmentBatch.settled >= enrichmentBatch.total)
    ) {
      return false
    }
  }

  const ttlMs = input.ttlMs ?? COLD_START_POST_RELEASE_BANNER_TTL_MS
  if (nowMs - readyMs >= ttlMs || nowMs < readyMs) {
    return false
  }

  // 无批次时的弱启发式（如 timeout 且尚未写出 batch）
  if (state.aiLlmEnqueued > 0 || reason === 'ai_best_effort_timeout') {
    return true
  }

  return false
}
