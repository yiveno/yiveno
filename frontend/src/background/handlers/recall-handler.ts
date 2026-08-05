import { recallService } from '@/application/recall/recall-service'
import type { RecallBackgroundResponse } from '@/core/messaging/recall-messages'
import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import { logger } from '@/infrastructure/logging/logger'

/** 根据线索执行 Recall。 */
export async function handleRecallWithClue(payload: unknown): Promise<RecallBackgroundResponse> {
  const startedAt = Date.now()
  try {
    const input = parseRecallWithCluePayload(payload)
    const context = input.context
    logger.info('Recall', '收到 RECALL_WITH_CLUE', {
      clue: input.clue,
      clueLength: input.clue.trim().length,
      priorCount: context?.priorUserUtterances?.length ?? 0,
      hasAccumulated: Boolean(context?.accumulated),
      dismissedCount: context?.dismissedIds?.length ?? 0
    })

    const result = await recallService.recallWithClue(input.clue, context ? { context } : undefined)
    logger.info('Recall', 'RECALL_WITH_CLUE 完成', {
      durationMs: Date.now() - startedAt,
      outcome: result.outcome,
      topPickId: result.topPick?.item.id ?? null,
      alsoPossibleCount: result.alsoPossible.length,
      effectiveClue: result.effectiveClue ?? null
    })
    return { ok: true, result }
  } catch (error) {
    logger.error('Recall', 'RECALL_WITH_CLUE 失败', {
      durationMs: Date.now() - startedAt,
      error
    })
    return {
      ok: false,
      errorCode: 'RECALL_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
