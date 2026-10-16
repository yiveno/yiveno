import { recallService } from '@/application/recall/recall-service'
import {
  clearActiveRecall,
  getActiveRecall,
  setActiveRecall
} from '@/background/handlers/active-recall-registry'
import type {
  GetRecallPageContextResponse,
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
import { normalizePageContextDomain, urlForPageContext } from '@/core/recall/page-context-mode'
import { notifyRecallVisibleProgress } from '@/infrastructure/messaging/notify-recall-visible-progress'
import { logger } from '@/infrastructure/logging/logger'

/**
 * §7.1：读 Side Panel 所在窗口的活动标签。
 * 不用「最近聚焦窗口」：焦点在面板上时，那个窗口的活动标签不一定是旁边正在看的网页。
 * chrome://、扩展页、新标签等不是站点 → 不回退到上一个网站。
 */
async function resolveRecallPageWindowId(): Promise<number | undefined> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.SIDE_PANEL]
  })
  const windowIds = contexts
    .map(context => context.windowId)
    .filter((windowId): windowId is number => typeof windowId === 'number' && windowId >= 0)
  if (windowIds.length === 0) {
    return undefined
  }
  if (windowIds.length === 1) {
    return windowIds[0]
  }
  const lastFocused = await chrome.windows.getLastFocused()
  if (typeof lastFocused.id === 'number' && windowIds.includes(lastFocused.id)) {
    return lastFocused.id
  }
  return windowIds[0]
}

async function resolveCurrentTabDomain(): Promise<string | undefined> {
  try {
    const panelWindowId = await resolveRecallPageWindowId()
    const [active] = await chrome.tabs.query(
      panelWindowId === undefined
        ? { active: true, lastFocusedWindow: true }
        : { active: true, windowId: panelWindowId }
    )
    const url = urlForPageContext(active)
    if (!url) {
      logger.info('Recall', '活动标签不是普通网页，页上下文不带域名', {
        windowId: panelWindowId ?? -1,
        url: active?.url ? active.url.slice(0, 48) : ''
      })
      return undefined
    }
    const domain = normalizePageContextDomain(extractDomainFromUrl(url))
    logger.info('Recall', '页上下文读到活动标签域名', {
      windowId: panelWindowId ?? -1,
      domain: domain ?? ''
    })
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
    // §7.1：仅 boost/restrict 解析并注入当前域名；none 不静默加成。
    const pageContextMode = input.context?.pageContextMode ?? 'none'
    const needsPageDomain = pageContextMode === 'boost' || pageContextMode === 'restrict'
    const tabDomain = needsPageDomain
      ? normalizePageContextDomain(
          input.context?.currentTabDomain ?? (await resolveCurrentTabDomain())
        )
      : undefined
    const context: RecallDialogContext | undefined =
      input.context || tabDomain
        ? {
            ...(input.context ?? {}),
            pageContextMode,
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
      pageContextMode,
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

/** composer 页上下文开关：读取当前浏览页域名（展示用，不改检索）。 */
export async function handleGetRecallPageContext(): Promise<GetRecallPageContextResponse> {
  try {
    const domain = normalizePageContextDomain(await resolveCurrentTabDomain()) ?? null
    logger.info('Recall', 'GET_RECALL_PAGE_CONTEXT', { domain })
    return { ok: true, domain }
  } catch (error) {
    logger.error('Recall', 'GET_RECALL_PAGE_CONTEXT 失败', { error })
    return {
      ok: false,
      errorCode: 'RECALL_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
