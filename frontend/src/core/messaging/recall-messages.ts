import { z } from 'zod'

import type { RecallResult } from '@/core/recall/recall-result'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

const recallWithCluePayloadSchema = z.object({
  clue: z.string().min(1).max(2000)
})

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
  error: string
}

export type RecallBackgroundResponse = RecallSuccessResponse | RecallErrorResponse

export function parseRecallWithCluePayload(value: unknown) {
  return recallWithCluePayloadSchema.parse(value)
}
