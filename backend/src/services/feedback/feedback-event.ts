/**
 * 结构化产品反馈契约（轨道 1）。
 * 触点 Channel ≠ 内容形态；邮箱只是 sink 之一，可换 DB。
 */

import { z } from 'zod'

/** 产品触点（自有表单）；社媒/真人来信不走本契约 */
export const FEEDBACK_SOURCES = [
  'uninstall', // 卸载落地页
  'website', // 官网主动反馈（预留）
  'in_app' // 扩展内反馈（预留）
] as const

export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

/** 卸载闭集原因；其它 source 可暂不带 reason */
export const UNINSTALL_FEEDBACK_REASONS = [
  'didnt_find', // 没找到保存的东西
  'too_hard', // 难用 / 困惑
  'missing_feature', // 缺功能
  'privacy', // 隐私或权限顾虑
  'bugs_or_slow', // 卡顿 / bug
  'just_trying', // 只是试试
  'other' // 其它
] as const

export type UninstallFeedbackReason = (typeof UNINSTALL_FEEDBACK_REASONS)[number]

const reasonSet = new Set<string>(UNINSTALL_FEEDBACK_REASONS)

export function normalizeUninstallReasons(
  reasons?: readonly string[],
  legacyReason?: string
): UninstallFeedbackReason[] {
  const out: UninstallFeedbackReason[] = []
  const seen = new Set<string>()
  for (const raw of [...(reasons ?? []), ...(legacyReason ? [legacyReason] : [])]) {
    if (!reasonSet.has(raw) || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw as UninstallFeedbackReason)
  }
  return out
}

export const FeedbackEventSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(FEEDBACK_SOURCES),
  /** 多选闭集原因 */
  reasons: z.array(z.enum(UNINSTALL_FEEDBACK_REASONS)).max(7).optional(),
  /** 首因（reasons[0]）；邮件 subject 简写 */
  reason: z.enum(UNINSTALL_FEEDBACK_REASONS).optional(),
  note: z.string().trim().max(500).optional(),
  createdAt: z.iso.datetime()
})

export type FeedbackEvent = z.infer<typeof FeedbackEventSchema>

export function createFeedbackEvent(input: {
  source: FeedbackSource
  reasons?: UninstallFeedbackReason[]
  reason?: UninstallFeedbackReason
  note?: string
}): FeedbackEvent {
  const reasons = normalizeUninstallReasons(input.reasons, input.reason)
  return FeedbackEventSchema.parse({
    id: crypto.randomUUID(),
    source: input.source,
    ...(reasons.length > 0 ? { reasons, reason: reasons[0] } : {}),
    ...(input.note && input.note.trim() ? { note: input.note.trim() } : {}),
    createdAt: new Date().toISOString()
  })
}
