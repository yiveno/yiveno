/**
 * Background 统一通知服务
 *
 * 职责：
 * - 提供统一的系统通知 API
 * - 处理权限检查和错误降级
 * - 支持前端消息调用和 Background 内部调用
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 通知选项
 */
export interface SystemNotificationOptions {
  /** 通知标题（默认：AcuityBookmarks） */
  title?: string | undefined
  /** 通知图标 URL */
  iconUrl?: string | undefined
  /** 是否需要用户交互才关闭 */
  requireInteraction?: boolean | undefined
  /** 自动关闭时间（毫秒），0 表示不自动关闭 */
  autoCloseMs?: number | undefined
}

/**
 * 检查通知权限是否可用
 */
export function isNotificationAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.notifications?.create
}

/**
 * 显示系统通知
 *
 * 统一入口，所有需要显示 Chrome 系统通知的地方都应调用此函数
 *
 * @param message - 通知内容
 * @param options - 通知选项
 * @returns 通知 ID，失败返回空字符串
 */
export async function showSystemNotification(
  message: string,
  options: SystemNotificationOptions = {}
): Promise<string> {
  if (!isNotificationAvailable()) {
    logger.debug('Notification', '系统通知不可用')
    return ''
  }

  const {
    title = 'AcuityBookmarks',
    iconUrl = chrome.runtime.getURL?.('images/icon128.png') || 'images/icon128.png',
    requireInteraction = false,
    autoCloseMs = 0
  } = options

  try {
    const notificationId = await new Promise<string>(resolve => {
      chrome.notifications.create(
        {
          type: 'basic',
          title,
          message,
          iconUrl,
          requireInteraction
        },
        id => resolve(id || '')
      )
    })

    // 自动关闭
    if (autoCloseMs > 0 && notificationId) {
      setTimeout(() => {
        clearSystemNotification(notificationId)
      }, autoCloseMs)
    }

    logger.debug('Notification', '系统通知已显示', { notificationId, title })
    return notificationId
  } catch (error) {
    logger.warn('Notification', '显示系统通知失败', error)
    return ''
  }
}

/**
 * 清除系统通知
 *
 * @param notificationId - 通知 ID
 */
export async function clearSystemNotification(notificationId: string): Promise<void> {
  if (!notificationId) return
  if (!chrome.notifications?.clear) return

  try {
    await new Promise<void>(resolve => {
      chrome.notifications.clear(notificationId, () => resolve())
    })
    logger.debug('Notification', '系统通知已清除', { notificationId })
  } catch (error) {
    logger.warn('Notification', '清除系统通知失败', { notificationId, error })
  }
}
