import { recallService } from '@/application/recall/recall-service'
import { getMemoryItemOpenHref, tryParseNavigableUrl } from '@/core/recall/memory-open-href'
import { escapeOmniboxXml, recallResultToOmniboxSuggests } from '@/core/recall/omnibox-suggest'
import { logger } from '@/infrastructure/logging/logger'

let listenersRegistered = false
let inputChangedRequestId = 0

/** 确保 Background 已启动（动态 import，避免与 bootstrap 循环依赖）。 */
async function ensureReady(): Promise<void> {
  const { ensureBackgroundBootstrapped } = await import('@/background/bootstrap')
  await ensureBackgroundBootstrapped()
}

function getDetailPageUrl(): string {
  return chrome.runtime.getURL('detail.html')
}

function getDefaultSuggestionDescription(): string {
  const text = chrome.i18n.getMessage('omnibox_default_suggestion') || '找回书签与摘录…'
  return escapeOmniboxXml(text)
}

function getNoMatchSuggestionDescription(): string {
  const text = chrome.i18n.getMessage('omnibox_no_match') || 'Yiveno 中未找到匹配'
  return escapeOmniboxXml(text)
}

/** 按 disposition 打开 URL（Omnibox 单次命中，无会话）。 */
async function openUrlByDisposition(
  url: string,
  disposition: chrome.omnibox.OnInputEnteredDisposition
): Promise<void> {
  switch (disposition) {
    case 'currentTab':
      await chrome.tabs.update({ url })
      return
    case 'newBackgroundTab':
      await chrome.tabs.create({ url, active: false })
      return
    case 'newForegroundTab':
    default:
      await chrome.tabs.create({ url })
  }
}

/** 输入变化：共用 recallService，映射为原生建议（无多轮）。 */
async function handleOmniboxInputChanged(
  text: string,
  suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void
): Promise<void> {
  const requestId = ++inputChangedRequestId
  const clue = text.trim()

  if (!clue) {
    chrome.omnibox.setDefaultSuggestion({ description: getDefaultSuggestionDescription() })
    suggest([])
    return
  }

  await ensureReady()
  const result = await recallService.recallWithClue(clue)

  if (requestId !== inputChangedRequestId) {
    return
  }

  const suggests = recallResultToOmniboxSuggests(result, {
    detailPageUrl: getDetailPageUrl()
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
  disposition: chrome.omnibox.OnInputEnteredDisposition
): Promise<void> {
  const directUrl = tryParseNavigableUrl(text)
  if (directUrl) {
    await openUrlByDisposition(directUrl, disposition)
    return
  }

  const clue = text.trim()
  if (!clue) {
    return
  }

  await ensureReady()
  const result = await recallService.recallWithClue(clue)
  const topHref = result.topPick
    ? getMemoryItemOpenHref(result.topPick.item, { detailPageUrl: getDetailPageUrl() })
    : ''
  const url = tryParseNavigableUrl(topHref)

  if (!url) {
    logger.info('Omnibox', '回车无 Top Pick，忽略导航', { clue })
    return
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
    void handleOmniboxInputChanged(text, suggest).catch(error => {
      logger.error('Omnibox', '输入变化处理失败', error)
      suggest([])
    })
  })

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    void handleOmniboxInputEntered(text, disposition).catch(error => {
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
