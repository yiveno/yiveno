import { recallService } from '@/application/recall/recall-service'
import type { RecallBackgroundResponse } from '@/core/messaging/recall-messages'
import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import { logger } from '@/infrastructure/logging/logger'

/** 根据线索执行 Recall。 */
export async function handleRecallWithClue(payload: unknown): Promise<RecallBackgroundResponse> {
  try {
    const input = parseRecallWithCluePayload(payload)
    const result = await recallService.recallWithClue(input.clue)
    return { ok: true, result }
  } catch (error) {
    logger.error('Background', 'Recall 失败', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Recall 失败'
    }
  }
}
