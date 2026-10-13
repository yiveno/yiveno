import { recallService } from '@/application/recall/recall-service'
import {
  clearActiveRecall,
  getActiveRecall,
  setActiveRecall
} from '@/background/handlers/active-recall-registry'
import type {
  RecallBackgroundResponse,
  RecallCancelResponse,
  RecallDialogContext,
  RecallSource
} from '@/core/messaging/recall-messages'
import {
  parseRecallCancelPayload,
  parseRecallWithCluePayload
} from '@/core/messaging/recall-messages'
import { extractDomainFromUrl } from '@/core/memory/payload'
import { notifyRecallVisibleProgress } from '@/infrastructure/messaging/notify-recall-visible-progress'
import { logger } from '@/infrastructure/logging/logger'

/** 是否可作为 §7.1 当前站信号的 http(s) 页。 */
function isHttpTabUrl(url: string | undefined): url is string {
  if (!url) {
    return false
  }
  return url.startsWith('http://') || url.startsWith('https://')
}

/** 从标签列表挑优先 http(s) 页（先 active，再任意）。 */
function pickHttpTab(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab | undefined {
  return (
    tabs.find(tab => tab.active && isHttpTabUrl(tab.url)) ?? tabs.find(tab => isHttpTabUrl(tab.url))
  )
}

/**
 * §7.1：读可用浏览页域名（弱上下文；失败则省略）。
 * 跳过 chrome-extension / chrome://（检查视图打开 sidepanel.html 时常见）。
 * Service Worker 下 `currentWindow` 不可靠 → 先 lastFocusedWindow，再全窗口回退。
 */
async function resolveCurrentTabDomain(): Promise<string | undefined> {
  try {
    const focused = await chrome.tabs.query({ lastFocusedWindow: true })
    let preferred = pickHttpTab(focused)
    if (!preferred) {
      preferred = pickHttpTab(await chrome.tabs.query({}))
    }
    const url = preferred?.url?.trim()
    if (!url || !isHttpTabUrl(url)) {
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
    const source: RecallSource = input.source
    const previousRecallId = setActiveRecall(source, input.recallId)
    if (previousRecallId && previousRecallId !== input.recallId) {
      logger.info('Recall', '同源新 recall 覆盖旧 activeRecallId（旧 in-flight 将早退）', {
        source,
        previousRecallId,
        newRecallId: input.recallId
      })
    }
    const tabDomain = input.context?.currentTabDomain ?? (await resolveCurrentTabDomain())
    const context: RecallDialogContext | undefined =
      input.context || tabDomain
        ? {
            ...(input.context ?? {}),
            ...(tabDomain ? { currentTabDomain: tabDomain } : {})
          }
        : undefined

    logger.info('Recall', '收到 RECALL_WITH_CLUE', {
      source,
      recallId: input.recallId,
      clue: input.clue,
      clueLength: input.clue.trim().length,
      priorCount: context?.priorUserUtterances?.length ?? 0,
      hasAccumulated: Boolean(context?.accumulated),
      dismissedCount: context?.dismissedIds?.length ?? 0,
      currentTabDomain: context?.currentTabDomain ?? null,
      progressRequestId: input.progressRequestId ?? null
    })

    // active recall 守卫：进入 recallService 前最后一道闸。
    // 若此期间被覆盖（同 source 新 recall / 显式 CANCEL），主动早退避免无效 LLM 调用 + 无效 telemetry。
    if (getActiveRecall(source) !== input.recallId) {
      logger.info('Recall', 'activeRecallId 已变（被覆盖或取消），早退', {
        source,
        requestedRecallId: input.recallId,
        currentActiveRecallId: getActiveRecall(source) ?? null
      })
      return {
        ok: false,
        errorCode: 'RECALL_FAILED',
        error: 'recall superseded'
      }
    }

    const progressRequestId = input.progressRequestId
    const result = await recallService.recallWithClue(input.clue, {
      ...(context ? { context } : {}),
      ...(progressRequestId
        ? {
            onVisibleProgress: stage => {
              // 进展阶段也校验守卫：若中途被覆盖，不再 push UI
              if (getActiveRecall(source) === input.recallId) {
                notifyRecallVisibleProgress({ progressRequestId, stage })
              }
            }
          }
        : {})
    })
    logger.info('Recall', 'RECALL_WITH_CLUE 完成', {
      source,
      recallId: input.recallId,
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

/** 显式取消 in-flight recall。Side Panel 提交新 clue 时同步发出。 */
export function handleRecallCancel(payload: unknown): RecallCancelResponse {
  const input = parseRecallCancelPayload(payload)
  const cleared = clearActiveRecall(input.source, input.recallId)
  logger.info('Recall', '收到 RECALL_CANCEL', {
    source: input.source,
    recallId: input.recallId,
    cleared
  })
  return { ok: true, cleared }
}
