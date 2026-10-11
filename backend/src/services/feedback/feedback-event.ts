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

export const FeedbackEventSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(FEEDBACK_SOURCES),
  reason: z.enum(UNINSTALL_FEEDBACK_REASONS).optional(),
  note: z.string().trim().max(500).optional(),
  createdAt: z.iso.datetime()
})

export type FeedbackEvent = z.infer<typeof FeedbackEventSchema>

export function createFeedbackEvent(input: {
  source: FeedbackSource
  reason?: UninstallFeedbackReason
  note?: string
}): FeedbackEvent {
  return FeedbackEventSchema.parse({
    id: crypto.randomUUID(),
    source: input.source,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.note && input.note.trim() ? { note: input.note.trim() } : {}),
    createdAt: new Date().toISOString()
  })
}
