/**
 * 语音快捷键页内反馈：优先向活动标签发 SHOW_VOICE_FEEDBACK 横幅；
 * 无 receiver / chrome:// / 注入失败 → 回落系统通知。
 */

import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { ensureSelectionToolbarContentScript } from '@/infrastructure/browser/selection-toolbar-command'
import { showVoiceRecallNotification } from '@/infrastructure/browser/voice-recall-notification'
import { logger } from '@/infrastructure/logging/logger'

const INJECT_RETRY_ATTEMPTS = 10
const INJECT_RETRY_DELAY_MS = 50

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/** 向指定标签发页内横幅；页内 shown=true 才算成功。 */
async function sendVoiceFeedbackToTab(
  tabId: number,
  input: { message: string; title?: string }
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      scope: 'content',
      type: 'SHOW_VOICE_FEEDBACK',
      message: input.message,
      ...(input.title ? { title: input.title } : {})
    })
    return (
      typeof response === 'object' &&
      response !== null &&
      'shown' in response &&
      (response as { shown: unknown }).shown === true
    )
  } catch (error) {
    logger.info('VoiceRecall', '页内横幅消息未送达', {
      tabId,
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * 尝试在活动可保存页展示语音反馈横幅。
 * @returns true = 页内已展示；false = 应回落系统通知
 */
export async function tryShowVoiceRecallPageBanner(input: {
  message: string
  title?: string
}): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tab?.id
  const url = tab?.url

  if (tabId === undefined || !url) {
    logger.info('VoiceRecall', '页内横幅跳过：无活动标签', { path: 'banner' })
    return false
  }
  if (!isSavablePageUrl(url)) {
    logger.info('VoiceRecall', '页内横幅跳过：不可注入页', {
      path: 'banner',
      urlPreview: url.slice(0, 80)
    })
    return false
  }

  if (await sendVoiceFeedbackToTab(tabId, input)) {
    logger.info('VoiceRecall', '页内横幅已展示', {
      path: 'banner',
      tabId,
      messagePreview: input.message.slice(0, 60)
    })
    return true
  }

  const injected = await ensureSelectionToolbarContentScript(tabId)
  if (injected) {
    for (let attempt = 0; attempt < INJECT_RETRY_ATTEMPTS; attempt += 1) {
      await delay(INJECT_RETRY_DELAY_MS)
      if (await sendVoiceFeedbackToTab(tabId, input)) {
        logger.info('VoiceRecall', '页内横幅已展示（注入后）', {
          path: 'banner',
          tabId,
          attempt: attempt + 1,
          messagePreview: input.message.slice(0, 60)
        })
        return true
      }
    }
  }

  logger.info('VoiceRecall', '页内横幅失败，将回落系统通知', {
    path: 'banner',
    tabId,
    injected
  })
  return false
}

/**
 * 语音反馈主入口：横幅优先，失败回落通知。
 * 日志用 path: banner | notification 区分两条路。
 */
export async function showVoiceRecallPageOrNotify(input: {
  title: string
  message: string
  /** 仅通知回落路径：点击开 Side Panel */
  openSidePanelOnClick?: boolean
}): Promise<'banner' | 'notification'> {
  const shown = await tryShowVoiceRecallPageBanner({
    message: input.message,
    title: input.title
  })
  if (shown) {
    return 'banner'
  }

  await showVoiceRecallNotification({
    title: input.title,
    message: input.message,
    ...(input.openSidePanelOnClick ? { openSidePanelOnClick: true } : {})
  })
  logger.info('VoiceRecall', '已走系统通知回落', {
    path: 'notification',
    messagePreview: input.message.slice(0, 60),
    openSidePanelOnClick: Boolean(input.openSidePanelOnClick)
  })
  return 'notification'
}
