/**
 * 语音快捷键反馈通知（打开成功 / 没听清 / 候选已备好 / 麦授权引导）。
 * 发送失败只记日志，不抛、不回滚打开。
 *
 * 两类点击行为互不混淆：
 * - 带 tabId：聚焦已打开标签
 * - 带 openSidePanelOnClick：在点击同步块内调 sidePanel.open（赶手势）
 */

import { openRecallSidePanel } from '@/infrastructure/browser/side-panel'
import { logger } from '@/infrastructure/logging/logger'

/** 通知 id 前缀，便于点击聚焦标签 / 开面板。 */
const NOTIFICATION_ID_PREFIX = 'yiveno-voice-recall-'

let clickListenerRegistered = false
const tabByNotificationId = new Map<string, number>()
const openPanelByNotificationId = new Set<string>()

/** 确保 notifications.onClicked 只挂一次。 */
function ensureNotificationClickListener(): void {
  if (clickListenerRegistered) {
    return
  }
  clickListenerRegistered = true
  chrome.notifications.onClicked.addListener(notificationId => {
    const tabId = tabByNotificationId.get(notificationId)
    const shouldOpenPanel = openPanelByNotificationId.has(notificationId)
    tabByNotificationId.delete(notificationId)
    openPanelByNotificationId.delete(notificationId)
    void chrome.notifications.clear(notificationId).catch(() => {})

    if (shouldOpenPanel) {
      // 点击是新鲜手势：同步发起 open，失败只记 warn，handoff 保留
      void openRecallSidePanel().catch(error => {
        logger.warn('VoiceRecall', '通知点击开面板失败', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
      return
    }

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

/** 仅测试：重置点击监听注册状态与映射。 */
export function resetVoiceRecallNotificationListenersForTests(): void {
  clickListenerRegistered = false
  tabByNotificationId.clear()
  openPanelByNotificationId.clear()
}

/** 发一条通知；失败吞掉并打日志。 */
export async function showVoiceRecallNotification(input: {
  title: string
  message: string
  /** 点击通知时聚焦的标签；缺省则仅关闭通知 */
  tabId?: number
  /**
   * 点击时在同步块内开 Side Panel（handoff 类通知）。
   * 与 tabId 互斥；同时传入时优先开面板。
   */
  openSidePanelOnClick?: boolean
}): Promise<boolean> {
  ensureNotificationClickListener()
  const notificationId = `${NOTIFICATION_ID_PREFIX}${Date.now()}`
  if (input.openSidePanelOnClick) {
    openPanelByNotificationId.add(notificationId)
  } else if (typeof input.tabId === 'number') {
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
      hasTab: typeof input.tabId === 'number',
      openSidePanelOnClick: Boolean(input.openSidePanelOnClick)
    })
    return true
  } catch (error) {
    tabByNotificationId.delete(notificationId)
    openPanelByNotificationId.delete(notificationId)
    logger.warn('VoiceRecall', '通知发送失败（不影响打开）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}
