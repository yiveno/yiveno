/**
 * 语音快捷键反馈通知（打开成功 / 没听清）。
 * 发送失败只记日志，不抛、不回滚打开。
 */

import { logger } from '@/infrastructure/logging/logger'

/** 通知 id 前缀，便于点击聚焦标签。 */
const NOTIFICATION_ID_PREFIX = 'yiveno-voice-recall-'

let clickListenerRegistered = false
const tabByNotificationId = new Map<string, number>()

/** 确保 notifications.onClicked 只挂一次。 */
function ensureNotificationClickListener(): void {
  if (clickListenerRegistered) {
    return
  }
  clickListenerRegistered = true
  chrome.notifications.onClicked.addListener(notificationId => {
    const tabId = tabByNotificationId.get(notificationId)
    tabByNotificationId.delete(notificationId)
    void chrome.notifications.clear(notificationId).catch(() => {})
    if (typeof tabId !== 'number') {
      return
    }
    void chrome.tabs
      .get(tabId)
      .then(async tab => {
        if (typeof tab.id === 'number') {
          await chrome.tabs.update(tab.id, { active: true })
        }
        if (typeof tab.windowId === 'number') {
          await chrome.windows.update(tab.windowId, { focused: true })
        }
      })
      .catch(error => {
        logger.warn('VoiceRecall', '通知点击聚焦标签失败', {
          tabId,
          error: error instanceof Error ? error.message : String(error)
        })
      })
  })
}

/** 发一条通知；失败吞掉并打日志。 */
export async function showVoiceRecallNotification(input: {
  title: string
  message: string
  /** 点击通知时聚焦的标签；缺省则仅关闭通知 */
  tabId?: number
}): Promise<boolean> {
  ensureNotificationClickListener()
  const notificationId = `${NOTIFICATION_ID_PREFIX}${Date.now()}`
  if (typeof input.tabId === 'number') {
    tabByNotificationId.set(notificationId, input.tabId)
  }
  try {
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: input.title,
      message: input.message,
      priority: 1
    })
    logger.info('VoiceRecall', '已发通知', {
      notificationId,
      titlePreview: input.title.slice(0, 40),
      hasTab: typeof input.tabId === 'number'
    })
    return true
  } catch (error) {
    tabByNotificationId.delete(notificationId)
    logger.warn('VoiceRecall', '通知发送失败（不影响打开）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}
