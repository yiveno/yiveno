/**
 * 分享通知监听器
 * 在 Background Script 中运行，监听新的分享通知
 * 
 * ⚠️ Service Worker 环境限制：
 * - 不能导入任何包含 Vue 的模块
 * - 不能导入任何包含 Material Web Components 的模块
 * - 不能导入任何包含 DOM API 的模块
 */

import { logger } from '@/infrastructure/logging/logger'
import type * as TrpcService from '@/services/trpc'

// ⚠️ 延迟导入 trpc，避免在模块加载时就引入依赖
let trpcModule: typeof TrpcService | null = null

async function getTrpc() {
  if (!trpcModule) {
    // eslint-disable-next-line require-atomic-updates -- 模块加载是原子操作，不会有竞态条件
    trpcModule = await import('@/services/trpc')
  }
  return trpcModule.trpc
}

/**
 * 初始化分享通知监听器
 */
export function initShareNotificationListener() {
  logger.info('ShareNotificationListener', '初始化分享通知监听器')

  // 定期检查新通知（每 5 分钟）
  const CHECK_INTERVAL = 5 * 60 * 1000 // 5 分钟

  // 立即检查一次
  checkNewNotifications()

  // 设置定时检查
  setInterval(() => {
    checkNewNotifications()
  }, CHECK_INTERVAL)

  // 监听扩展安装/更新事件
  chrome.runtime.onInstalled.addListener(() => {
    logger.info('ShareNotificationListener', '扩展已安装/更新，检查通知')
    checkNewNotifications()
  })

  // 监听浏览器启动事件
  chrome.runtime.onStartup.addListener(() => {
    logger.info('ShareNotificationListener', '浏览器已启动，检查通知')
    checkNewNotifications()
  })
}

/**
 * 检查新通知
 */
async function checkNewNotifications() {
  try {
    // 从 chrome.storage 获取 access token
    const result = await chrome.storage.local.get(['supabase_session']) as {
      supabase_session?: { access_token: string }
    }
    
    if (!result.supabase_session?.access_token) {
      logger.debug('ShareNotificationListener', '用户未登录，跳过通知检查')
      return
    }

    const accessToken = result.supabase_session.access_token

    // ⚠️ 延迟导入 trpc，避免在模块加载时就引入依赖
    const trpc = await getTrpc()

    // 获取未读通知数量
    // @ts-expect-error - tRPC 类型推断问题
    const unreadCountResult = await trpc.share.getUnreadCount.query({ accessToken })
    
    if (!unreadCountResult.success) {
      logger.error('ShareNotificationListener', '获取未读数量失败')
      return
    }

    const unreadCount = unreadCountResult.data.count
    
    logger.info('ShareNotificationListener', '未读通知数量', { unreadCount })

    // 更新 Badge
    await updateBadge(unreadCount)

    // 如果有未读通知，获取最新的通知
    if (unreadCount > 0) {
      // @ts-expect-error - tRPC 类型推断问题
      const notificationsResult = await trpc.share.getNotifications.query({
        accessToken,
        unreadOnly: true,
        limit: 5
      })

      if (!notificationsResult.success) {
        logger.error('ShareNotificationListener', '获取通知列表失败')
        return
      }

      const notifications = notificationsResult.data

      // 显示最新的通知（只显示最近 1 小时内的）
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      const recentNotifications = notifications.filter((n: { created_at: string }) => {
        const createdAt = new Date(n.created_at).getTime()
        return createdAt > oneHourAgo
      })

      for (const notification of recentNotifications) {
        await showChromeNotification(notification)
      }
    }
  } catch (error) {
    logger.error('ShareNotificationListener', '检查通知失败', error)
  }
}

/**
 * 更新扩展图标 Badge（显示未读数量）
 */
async function updateBadge(count: number): Promise<void> {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() })
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' })
    } else {
      await chrome.action.setBadgeText({ text: '' })
    }

    logger.info('ShareNotificationListener', 'Badge 已更新', { count })
  } catch (error) {
    logger.error('ShareNotificationListener', '更新 Badge 失败', error)
  }
}

/**
 * 显示 Chrome 系统通知
 */
async function showChromeNotification(notification: { 
  title: string
  message: string
  data?: { share_url?: string; [key: string]: unknown }
}): Promise<void> {
  try {
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

    logger.info('ShareNotificationListener', 'Chrome 通知已显示', {
      notificationId: chromeNotification
    })

    // 监听通知按钮点击
    chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
      if (notifId === chromeNotification) {
        if (buttonIndex === 0 && notification.data?.share_url) {
          // 点击"查看"按钮，打开分享链接
          chrome.tabs.create({ url: notification.data.share_url })
        }
        // 关闭通知
        chrome.notifications.clear(notifId)
      }
    })

    // 监听通知点击
    chrome.notifications.onClicked.addListener((notifId) => {
      if (notifId === chromeNotification && notification.data?.share_url) {
        // 点击通知本身，打开分享链接
        chrome.tabs.create({ url: notification.data.share_url })
        chrome.notifications.clear(notifId)
      }
    })
  } catch (error) {
    logger.error('ShareNotificationListener', '显示 Chrome 通知失败', error)
  }
}

/**
 * 手动触发通知检查（供其他模块调用）
 */
export function triggerNotificationCheck() {
  logger.info('ShareNotificationListener', '手动触发通知检查')
  checkNewNotifications()
}
