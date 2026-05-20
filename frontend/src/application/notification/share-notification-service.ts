/**
 * 分享通知服务
 * 负责处理分享相关的通知（接收、显示、管理）
 */

import { logger } from '@/infrastructure/logging/logger'
import { trpc } from '@/services/trpc'

/**
 * 通知类型
 */
export interface ShareNotification {
  id: string
  user_id: string
  type: 'share_received'
  title: string
  message: string
  data: {
    share_id: string
    short_code: string
    share_url: string
    sender_id: string
    sender_name: string
  }
  read: boolean
  created_at: string
}

/**
 * 分享通知服务
 */
class ShareNotificationService {
  /**
   * 获取未读通知数量
   */
  async getUnreadCount(accessToken: string): Promise<number> {
    try {
      // @ts-expect-error - tRPC 类型推断问题
      const result = await trpc.share.getUnreadCount.query({ accessToken })
      
      if (result.success) {
        return result.data.count
      }
      
      return 0
    } catch (error) {
      logger.error('ShareNotificationService', '获取未读数量失败', error)
      return 0
    }
  }

  /**
   * 获取通知列表
   */
  async getNotifications(
    accessToken: string,
    options: {
      unreadOnly?: boolean
      limit?: number
      offset?: number
    } = {}
  ): Promise<ShareNotification[]> {
    try {
      // @ts-expect-error - tRPC 类型推断问题
      const result = await trpc.share.getNotifications.query({
        accessToken,
        unreadOnly: options.unreadOnly ?? false,
        limit: options.limit ?? 20,
        offset: options.offset ?? 0
      })
      
      if (result.success) {
        return result.data as ShareNotification[]
      }
      
      return []
    } catch (error) {
      logger.error('ShareNotificationService', '获取通知列表失败', error)
      return []
    }
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: string, accessToken: string): Promise<boolean> {
    try {
      // @ts-expect-error - tRPC 类型推断问题
      const result = await trpc.share.markNotificationAsRead.mutate({
        notificationId,
        accessToken
      })
      
      return result.success
    } catch (error) {
      logger.error('ShareNotificationService', '标记通知失败', error)
      return false
    }
  }

  /**
   * 显示 Chrome 系统通知
   */
  async showChromeNotification(notification: ShareNotification): Promise<void> {
    try {
      // ⚠️ Service Worker 环境检查：没有 window 和 Notification API
      // 直接使用 chrome.notifications API
      
      // 创建 Chrome 通知
      const chromeNotification = await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: notification.title,
        message: notification.message,
        buttons: [
          { title: '查看' },
          { title: '稍后' }
        ],
        requireInteraction: true
      })

      logger.info('ShareNotificationService', 'Chrome 通知已显示', {
        notificationId: chromeNotification
      })

      // 监听通知按钮点击
      chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
        if (notifId === chromeNotification) {
          if (buttonIndex === 0) {
            // 点击"查看"按钮，打开分享链接
            chrome.tabs.create({ url: notification.data.share_url })
          }
          // 关闭通知
          chrome.notifications.clear(notifId)
        }
      })

      // 监听通知点击
      chrome.notifications.onClicked.addListener((notifId) => {
        if (notifId === chromeNotification) {
          // 点击通知本身，打开分享链接
          chrome.tabs.create({ url: notification.data.share_url })
          chrome.notifications.clear(notifId)
        }
      })
    } catch (error) {
      logger.error('ShareNotificationService', '显示 Chrome 通知失败', error)
    }
  }

  /**
   * 更新扩展图标 Badge（显示未读数量）
   */
  async updateBadge(count: number): Promise<void> {
    try {
      if (count > 0) {
        await chrome.action.setBadgeText({ text: count.toString() })
        await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' })
      } else {
        await chrome.action.setBadgeText({ text: '' })
      }

      logger.info('ShareNotificationService', 'Badge 已更新', { count })
    } catch (error) {
      logger.error('ShareNotificationService', '更新 Badge 失败', error)
    }
  }
}

export const shareNotificationService = new ShareNotificationService()
