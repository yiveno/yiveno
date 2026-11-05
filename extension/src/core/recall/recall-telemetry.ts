/**
 * Recall TTE 埋点 schema 与 ECS 打分（§5.9 · §5.10.3）。
 * 纯函数 + Zod；无 Chrome / DOM 依赖。
 */

import { z } from 'zod'

/** Recall 流水线分段耗时（理解 vs 检索 vs 后处理）。 */
export const RecallPipelineTimingSchema = z.object({
  /** 线索理解（LLM / 规则 parse）毫秒 */
  understandMs: z.number().int().nonnegative(),
  /** 候选加载（IndexedDB 扫描）毫秒 */
  candidateLoadMs: z.number().int().nonnegative(),
  /** 排序 / Hybrid 融合 / 折叠毫秒 */
  retrieveMs: z.number().int().nonnegative(),
  /** 追问 / Narrow 举例等后处理毫秒 */
  postProcessMs: z.number().int().nonnegative().optional(),
  /** 流水线总毫秒（含上述分段） */
  totalMs: z.number().int().nonnegative(),
  /** 理解来源：llm | rules | … */
  understandSource: z.string().optional(),
  /** 是否走 Hybrid 融合 */
  usedHybrid: z.boolean().optional(),
  /** 内容佐证空窗后是否做过一次时间 soft 回退（ADR-011 例外） */
  timeSoftReopen: z.boolean().optional()
})

export type RecallPipelineTiming = z.infer<typeof RecallPipelineTimingSchema>

/** 遥测事件公共头。 */
const telemetryBaseSchema = z.object({
  /** 一次找会话 / 任务 id */
  taskId: z.uuid(),
  /** 本轮请求追踪 id */
  traceId: z.uuid(),
  /** 事件时间（ISO） */
  at: z.iso.datetime()
})

/** 可见进展峰值阶段（体验度量 · 非 §5.9 TTE KPI）。 */
export const RecallWaitPeakStageSchema = z.enum([
  'understanding', // 理解印象
  'narrowing', // 库内收窄
  'checking' // 核对最接近
])

/** 等待中放弃原因（体验 · 与 TTE 分计）。 */
export const RecallWaitAbandonReasonSchema = z.enum([
  'panel_close', // 关 Side Panel
  'new_find', // 新找清空线程
  'superseded_clue' // 等待中改发另一条 clue
])

/** 可见进展快照（放弃 / 出结果时附带）。 */
export const RecallWaitProgressSnapshotSchema = z.object({
  /** 是否已揭示进度文案（过 500ms 门槛） */
  progressRevealed: z.boolean(),
  /** 本轮等待已过毫秒 */
  waitElapsedMs: z.number().int().nonnegative(),
  /** 等待期间到达的最高阶段 */
  peakStage: RecallWaitPeakStageSchema.optional(),
  /**
   * understanding 等待梯级 1–4（§7.0）。
   * 1=初文案；2≥4s；3≥8s；4≥10s 软预期 rules_fallback
   */
  understandingTier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional()
})

export type RecallWaitProgressSnapshot = z.infer<typeof RecallWaitProgressSnapshotSchema>
export type RecallWaitAbandonReason = z.infer<typeof RecallWaitAbandonReasonSchema>

/** `evidence_visible.anchor` 上限（埋点预览，非 UI 展示宽度）。 */
export const RECALL_TELEMETRY_EVIDENCE_ANCHOR_MAX_CHARS = 200

/** 写入埋点前截断 anchor，避免超长摘录/标题撑爆 Zod。 */
export function truncateRecallTelemetryAnchor(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length <= RECALL_TELEMETRY_EVIDENCE_ANCHOR_MAX_CHARS) {
    return trimmed
  }
  return trimmed.slice(0, RECALL_TELEMETRY_EVIDENCE_ANCHOR_MAX_CHARS)
}

/**
 * TTE 七事件 + 体验 `wait_abandoned`（§5.9 最小埋点 ∪ §7.0 可见进展度量）。
 * `wait_abandoned` **不得**计入 Success@180 / TTE 达标。
 */
export const RecallTelemetryEventSchema = z.discriminatedUnion('type', [
  telemetryBaseSchema.extend({
    type: z.literal('clue_submitted'),
    cluePreview: z.string().max(120)
  }),
  telemetryBaseSchema.extend({
    type: z.literal('clue_refined'),
    cluePreview: z.string().max(120),
    priorCluePreview: z.string().max(120).optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('result_rendered'),
    outcome: z.enum([
      'top_pick', // 有 Top Pick 建议
      'need_a_clue', // 弱邻域，需补线索
      'no_match' // 无命中
    ]),
    resultCount: z.number().int().nonnegative(),
    pipelineTiming: RecallPipelineTimingSchema.optional(),
    /** 可见进展快照（体验 A/B；可选） */
    waitProgress: RecallWaitProgressSnapshotSchema.optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('evidence_visible'),
    memoryItemId: z.uuid(),
    rank: z.number().int().nonnegative(),
    ecs: z.number().int().min(0).max(5),
    reasonCodes: z.array(z.string()).optional(),
    /** 可见证据锚点预览（摘录/标题）；写入前须 ≤ 上限 */
    anchor: z.string().max(RECALL_TELEMETRY_EVIDENCE_ANCHOR_MAX_CHARS).optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('source_opened'),
    memoryItemId: z.uuid(),
    rank: z.number().int().nonnegative().optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('user_confirmed'),
    label: z.enum([
      'target', // 目标条目
      'none_in_results', // 以上都不是
      'absent', // 库内没有
      'unknown' // 未知
    ]),
    confidence: z
      .enum([
        'strong', // 强
        'medium_high', // 中高
        'medium', // 中
        'medium_low' // 中低
      ])
      .optional(),
    source: z.enum([
      'mark', // 兼容旧落盘；不再由 UI 产生
      'dismiss', // dismiss
      'no_match', // no_match 出口
      'exit_prompt', // 出口条
      'settled_single', // C1 单条 settled
      'settled_last', // C2 末条 settled
      'copy', // 复制等弱确认
      'unresolved' // 未决议
    ]),
    memoryItemId: z.uuid().optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('task_timeout'),
    timeoutMs: z.number().int().positive()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('wait_abandoned'),
    reason: RecallWaitAbandonReasonSchema,
    waitProgress: RecallWaitProgressSnapshotSchema
  })
])

export type RecallTelemetryEvent = z.infer<typeof RecallTelemetryEventSchema>

/** ECS 打分输入（卡模型字段子集）。 */
export interface RecallEvidenceEcsInput {
  typeLabel: string
  subtitle: string
  title: string
  url: string
  excerpt?: string
  savedAtIso?: string
  reasonLine?: string
}

/** 线索预览（日志 / 埋点；不含完整 PII）。 */
export function previewRecallClue(clue: string, maxLen = 120): string {
  const trimmed = clue.trim()
  if (trimmed.length <= maxLen) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLen - 1)}…`
}

function hasSourceIdentity(input: RecallEvidenceEcsInput): boolean {
  return Boolean(input.typeLabel.trim()) && Boolean(input.subtitle.trim() || input.title.trim())
}

function hasReachableOriginal(url: string): boolean {
  const trimmed = url.trim()
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('detail.html')
  )
}

function hasContentAnchor(input: RecallEvidenceEcsInput): boolean {
  return Boolean(input.excerpt?.trim()) || Boolean(input.title.trim())
}

function hasSavedTime(savedAtIso: string | undefined): boolean {
  if (!savedAtIso?.trim()) {
    return false
  }
  return Number.isFinite(Date.parse(savedAtIso))
}

function hasHitReason(reasonLine: string | undefined): boolean {
  return Boolean(reasonLine?.trim())
}

/**
 * ECS 快速标注 0–5（对齐 TTE checklist §7）。
 * 1 来源身份 · 2 +可达 · 3 +锚点 · 4 +保存时间 · 5 +命中理由。
 */
export function scoreRecallEvidenceEcs(input: RecallEvidenceEcsInput): number {
  if (!hasSourceIdentity(input)) {
    return 0
  }
  let score = 1
  if (hasReachableOriginal(input.url)) {
    score = 2
  }
  if (score >= 2 && hasContentAnchor(input)) {
    score = 3
  }
  if (score >= 3 && hasSavedTime(input.savedAtIso)) {
    score = 4
  }
  if (score >= 4 && hasHitReason(input.reasonLine)) {
    score = 5
  }
  return score
}

/** 校验单条 TTE 事件。 */
export function parseRecallTelemetryEvent(value: unknown): RecallTelemetryEvent {
  return RecallTelemetryEventSchema.parse(value)
}

/** TTE 任务超时默认 180s（Success@180）。 */
export const RECALL_TTE_TASK_TIMEOUT_MS = 180_000
