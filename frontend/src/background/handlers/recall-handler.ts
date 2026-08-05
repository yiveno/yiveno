import { recallService } from '@/application/recall/recall-service'
import type {
  RecallBackgroundResponse,
  RecallDialogContext
} from '@/core/messaging/recall-messages'
import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import { extractDomainFromUrl } from '@/core/memory/payload'
import { logger } from '@/infrastructure/logging/logger'

/** §7.1：从当前活动标签读域名（弱上下文；失败则省略）。 */
async function resolveCurrentTabDomain(): Promise<string | undefined> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url?.trim()
    if (!url) {
      return undefined
    }
    const domain = extractDomainFromUrl(url)
    return domain || undefined
  } catch (error) {
    logger.info('Recall', '读取当前标签域名失败（忽略）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return undefined
  }
}

/** 根据线索执行 Recall。 */
export async function handleRecallWithClue(payload: unknown): Promise<RecallBackgroundResponse> {
  const startedAt = Date.now()
  try {
    const input = parseRecallWithCluePayload(payload)
    const tabDomain = input.context?.currentTabDomain ?? (await resolveCurrentTabDomain())
    const context: RecallDialogContext | undefined =
      input.context || tabDomain
        ? {
            ...(input.context ?? {}),
            ...(tabDomain ? { currentTabDomain: tabDomain } : {})
          }
        : undefined

    logger.info('Recall', '收到 RECALL_WITH_CLUE', {
      clue: input.clue,
      clueLength: input.clue.trim().length,
      priorCount: context?.priorUserUtterances?.length ?? 0,
      hasAccumulated: Boolean(context?.accumulated),
      dismissedCount: context?.dismissedIds?.length ?? 0,
      currentTabDomain: context?.currentTabDomain ?? null
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
