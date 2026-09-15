/**
 * SW → 扩展页（记忆库等）推送消息 scope。
 */
import { z } from 'zod'

import {
  RECALL_VISIBLE_PROGRESS_STAGES,
  type RecallVisibleProgressStage
} from '@/core/recall/visible-progress'

/** SW → 扩展页（记忆库等）推送消息 scope。 */
export const UI_MESSAGE_SCOPE = 'ui' as const

export type UiMessageScope = typeof UI_MESSAGE_SCOPE

/**
 * SW 通知：Chrome 书签树已变（增删改移/改名）。
 * 记忆库应重拉 GET_BOOKMARK_LIBRARY_TREE；与 Memory 灌库成败无关。
 */
export type ChromeBookmarkTreeChangedMessage = {
  scope: UiMessageScope
  type: 'CHROME_BOOKMARK_TREE_CHANGED' // Chrome 书签树变更
}

/**
 * SW 通知：本轮 Recall 真实 pipeline 阶段（可见进展 §7.0）。
 * Side Panel 按 progressRequestId 过滤；&lt;500ms 门控在 UI。
 */
export type RecallVisibleProgressMessage = {
  scope: UiMessageScope
  type: 'RECALL_VISIBLE_PROGRESS' // Recall 可见进展阶段
  payload: {
    /** 与 RECALL_WITH_CLUE.payload.progressRequestId 对齐 */
    progressRequestId: string
    stage: RecallVisibleProgressStage
  }
}

/** SW → UI 推送联合。 */
export type UiPushMessage = ChromeBookmarkTreeChangedMessage | RecallVisibleProgressMessage

const chromeBookmarkTreeChangedSchema = z.object({
  scope: z.literal(UI_MESSAGE_SCOPE),
  type: z.literal('CHROME_BOOKMARK_TREE_CHANGED')
})

const recallVisibleProgressSchema = z.object({
  scope: z.literal(UI_MESSAGE_SCOPE),
  type: z.literal('RECALL_VISIBLE_PROGRESS'),
  payload: z.object({
    progressRequestId: z.string().min(1).max(128),
    stage: z.enum(RECALL_VISIBLE_PROGRESS_STAGES)
  })
})

/** 解析 SW → UI 书签树变更通知；非法则返回 null。 */
export function parseChromeBookmarkTreeChangedMessage(
  value: unknown
): ChromeBookmarkTreeChangedMessage | null {
  const parsed = chromeBookmarkTreeChangedSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** 解析 Recall 可见进展推送；非法则返回 null。 */
export function parseRecallVisibleProgressMessage(
  value: unknown
): RecallVisibleProgressMessage | null {
  const parsed = recallVisibleProgressSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function isUiScopedMessage(
  value: unknown
): value is { scope: UiMessageScope; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scope' in value &&
    (value as { scope: unknown }).scope === UI_MESSAGE_SCOPE
  )
}
