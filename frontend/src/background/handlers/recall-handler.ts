import { recallService } from '@/application/recall/recall-service'
import type {
  RecallBackgroundResponse,
  RecallDialogContext
} from '@/core/messaging/recall-messages'
import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import { extractDomainFromUrl } from '@/core/memory/payload'
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
