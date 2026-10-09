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

const telemetryBaseSchema = z.object({
  taskId: z.uuid(),
  traceId: z.uuid(),
  at: z.iso.datetime()
})

/** TTE 七事件 discriminated union（§5.9 最小埋点）。 */
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
    outcome: z.enum(['top_pick', 'need_a_clue', 'no_match']),
    resultCount: z.number().int().nonnegative(),
    pipelineTiming: RecallPipelineTimingSchema.optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('evidence_visible'),
    memoryItemId: z.uuid(),
    rank: z.number().int().nonnegative(),
    ecs: z.number().int().min(0).max(5),
    reasonCodes: z.array(z.string()).optional(),
    anchor: z.string().max(200).optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('source_opened'),
    memoryItemId: z.uuid(),
    rank: z.number().int().nonnegative().optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('user_confirmed'),
    label: z.enum(['target', 'none_in_results', 'absent', 'unknown']),
    confidence: z.enum(['strong', 'medium_high', 'medium', 'medium_low']).optional(),
    source: z.enum([
      'mark',
      'dismiss',
      'no_match',
      'exit_prompt',
      'settled_single',
      'settled_last',
      'copy',
      'unresolved'
    ]),
    memoryItemId: z.uuid().optional()
  }),
  telemetryBaseSchema.extend({
    type: z.literal('task_timeout'),
    timeoutMs: z.number().int().positive()
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
