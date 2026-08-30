import { recallService } from '@/application/recall/recall-service'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  getMemoryItemOpenHref,
  tryParseNavigableUrl,
  tryParseOmniboxOpenMemoryId
} from '@/core/recall/memory-open-href'
import { escapeOmniboxXml, recallResultToOmniboxSuggests } from '@/core/recall/omnibox-suggest'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

let listenersRegistered = false
let inputChangedRequestId = 0

/** 为一次 onInputChanged 分配序号，供过期丢弃与错误兜底使用。 */
function beginOmniboxInputChangedRequest(): number {
  return ++inputChangedRequestId
}

function isStaleOmniboxInputChangedRequest(requestId: number): boolean {
  return requestId !== inputChangedRequestId
}

/** 确保 Background 已启动（动态 import，避免与 bootstrap 循环依赖）。 */
async function ensureReady(): Promise<void> {
  const { ensureBackgroundBootstrapped } = await import('@/background/bootstrap')
  await ensureBackgroundBootstrapped()
}

function getDetailPageUrl(): string {
  return chrome.runtime.getURL('detail.html')
}

function getDefaultSuggestionDescription(): string {
  return escapeOmniboxXml(t('omnibox_default_suggestion'))
}

function getNoMatchSuggestionDescription(): string {
  return escapeOmniboxXml(t('omnibox_no_match'))
}

/** 按 disposition 打开 URL（Omnibox 单次命中，无会话）。 */
async function openUrlByDisposition(
  url: string,
  disposition: 'currentTab' | 'newBackgroundTab' | 'newForegroundTab'
): Promise<void> {
  if (disposition === 'newBackgroundTab') {
    await chrome.tabs.create({ url, active: false })
    return
  }

  await navigateTabToUrl(
    url,
    disposition === 'newForegroundTab' ? 'newForegroundTab' : 'currentTab'
  )
}

/** 尽力记录打开；失败不影响导航。 */
async function recordOpenBestEffort(memoryItemId: string | null | undefined): Promise<void> {
  if (!memoryItemId) {
    return
  }
  try {
    await memoryItemService.recordOpen(memoryItemId)
  } catch (error) {
    logger.error('Omnibox', '记录 Memory 打开失败', error)
  }
}

/** Omnibox 输入变化：离线查找轨（规则 parse + Filter ± embedding），映射为原生建议。 */
async function handleOmniboxInputChanged(
  requestId: number,
  text: string,
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void
): Promise<void> {
  const clue = text.trim()

  if (!clue) {
    chrome.omnibox.setDefaultSuggestion({ description: getDefaultSuggestionDescription() })
    suggest([])
    return
  }

  // 新线索到达时立即清空上一轮建议，避免召回完成前仍展示旧列表（Chrome 不会自动清）。
  chrome.omnibox.setDefaultSuggestion({ description: getDefaultSuggestionDescription() })
  suggest([])

  await ensureReady()
  if (isStaleOmniboxInputChangedRequest(requestId)) {
    logger.info('Omnibox', 'inputChanged：bootstrap 后已过期，丢弃', { requestId })
    return
  }

  logger.info('Omnibox', 'inputChanged：开始 Recall', {
    requestId,
    clueLength: clue.length
  })
  const result = await recallService.recallWithClue(clue, { entry: 'omnibox' })

  if (isStaleOmniboxInputChangedRequest(requestId)) {
    logger.info('Omnibox', 'inputChanged：结果已过期，丢弃', { requestId })
    return
  }

  logger.info('Omnibox', 'inputChanged：Recall 完成', {
    requestId,
    outcome: result.outcome,
    alsoPossibleCount: result.alsoPossible.length
  })

  const suggests = recallResultToOmniboxSuggests(result, {
    detailPageUrl: getDetailPageUrl(),
    translate: t,
    clue: result.effectiveClue ?? clue
  })
  if (suggests.length === 0) {
    chrome.omnibox.setDefaultSuggestion({ description: getNoMatchSuggestionDescription() })
    suggest([])
    return
  }

  chrome.omnibox.setDefaultSuggestion({ description: getDefaultSuggestionDescription() })
  suggest(suggests)
}

/**
 * 确认输入：选中建议时 text 为打开地址；直接回车时 text 为线索，再跑一轮 Recall 打开 Top Pick。
 * Omnibox 永不开启追问会话。
 */
async function handleOmniboxInputEntered(
  text: string,
  disposition: 'currentTab' | 'newBackgroundTab' | 'newForegroundTab'
): Promise<void> {
  await ensureReady()
  const detailPageUrl = getDetailPageUrl()

  // 书签建议：omnibox-open.html?id= → 写回后打开真实 URL（不落占位页）
  const omniboxOpenId = tryParseOmniboxOpenMemoryId(text)
  if (omniboxOpenId) {
    await recordOpenBestEffort(omniboxOpenId)
    const item = await memoryItemService.getById(omniboxOpenId)
    const href = item ? getMemoryItemOpenHref(item, { detailPageUrl }).trim() : ''
    const url = tryParseNavigableUrl(href)
    if (!url) {
      logger.info('Omnibox', '占位建议无法解析目标', { omniboxOpenId })
      return
    }
    await openUrlByDisposition(url, disposition)
    return
  }

  const directUrl = tryParseNavigableUrl(text)
  if (directUrl) {
    // 摘录详情页由 Detail 记录打开；遗留书签直链无 id，此处不写
    await openUrlByDisposition(directUrl, disposition)
    return
  }

  const clue = text.trim()
  if (!clue) {
    return
  }

  const result = await recallService.recallWithClue(clue, { entry: 'omnibox' })
  const topPick = result.topPick
  const topHref = topPick ? getMemoryItemOpenHref(topPick.item, { detailPageUrl }) : ''
  const url = tryParseNavigableUrl(topHref)

  if (!url) {
    logger.info('Omnibox', '回车无 Top Pick，忽略导航', { clue })
    return
  }

  // 书签在此记；摘录进详情由 Detail 记
  if (topPick?.item.type === 'bookmark') {
    await recordOpenBestEffort(topPick.item.id)
  }
  await openUrlByDisposition(url, disposition)
}

/** 注册 Omnibox 监听器（仅 Background 调用一次）。 */
export function registerOmniboxListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  chrome.omnibox.setDefaultSuggestion({ description: getDefaultSuggestionDescription() })

  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const requestId = beginOmniboxInputChangedRequest()
    void handleOmniboxInputChanged(requestId, text, suggest).catch(error => {
      if (isStaleOmniboxInputChangedRequest(requestId)) {
        return
      }
      logger.error('Omnibox', '输入变化处理失败', error)
      suggest([])
    })
  })

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    void handleOmniboxInputEntered(
      text,
      disposition as 'currentTab' | 'newBackgroundTab' | 'newForegroundTab'
    ).catch(error => {
      logger.error('Omnibox', '确认输入处理失败', error)
    })
  })

  logger.info('Omnibox', 'Omnibox 找回监听器已注册')
}

/** 测试用：重置监听器注册状态。 */
export function resetOmniboxListenersForTests(): void {
  listenersRegistered = false
  inputChangedRequestId = 0
}
