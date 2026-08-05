import { z } from 'zod'

import { ParsedRecallClueSchema } from '@/core/recall/parse-recall-clue-types'
import type { RecallResult } from '@/core/recall/recall-result'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** Popup 多轮会话上下文（Omnibox 不传）。 */
export const recallDialogContextSchema = z.object({
  /** 本轮之前已发送的用户原文（有序；最多 5）。 */
  priorUserUtterances: z.array(z.string().max(2000)).max(5).optional(),
  /** 上一轮合并后的 ParsedRecallClue 快照。 */
  accumulated: ParsedRecallClueSchema.optional(),
  /** 本会话已否定的 MemoryItem id（硬排除）。 */
  dismissedIds: z.array(z.string().uuid()).max(50).optional(),
  /** 当前标签页域名（§7.1 同域软重排；不含路径）。 */
  currentTabDomain: z.string().max(253).optional()
})

export type RecallDialogContext = z.infer<typeof recallDialogContextSchema>

const recallWithCluePayloadSchema = z.object({
  clue: z.string().min(1).max(2000),
  context: recallDialogContextSchema.optional()
})

/** Recall 面向 UI 的稳定错误码。 */
export const RecallErrorCodeSchema = z.enum([
  'RECALL_FAILED' // 找回流水线失败
])

export type RecallErrorCode = z.infer<typeof RecallErrorCodeSchema>

/** 根据线索执行 Recall。 */
export type RecallWithClueMessage = {
  scope: BackgroundMessageScope
  type: 'RECALL_WITH_CLUE'
  payload: z.infer<typeof recallWithCluePayloadSchema>
}

export type RecallBackgroundMessage = RecallWithClueMessage

export type RecallSuccessResponse = {
  ok: true
  result: RecallResult
}

export type RecallErrorResponse = {
  ok: false
  errorCode: RecallErrorCode
  error?: string
}

export type RecallBackgroundResponse = RecallSuccessResponse | RecallErrorResponse

export function parseRecallWithCluePayload(value: unknown) {
  return recallWithCluePayloadSchema.parse(value)
}
