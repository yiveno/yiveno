import { z } from 'zod'

import type { RecallResult } from '@/core/recall/recall-result'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

const recallWithCluePayloadSchema = z.object({
  clue: z.string().min(1).max(2000)
})

/** Recall 面向 UI 的稳定错误码。 */
export const RecallErrorCodeSchema = z.enum(['RECALL_FAILED'])

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
