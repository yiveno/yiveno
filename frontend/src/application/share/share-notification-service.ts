/**
 * 分享通知应用服务
 * 封装后端通知接口，提供响应式状态管理
 *
 * @module application/share/share-notification-service
 */

import { ref, computed } from 'vue'
import { trpc } from '@/services/trpc'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 通知类型定义
 */
export interface ShareNotification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data?: {
    share_id?: string
    short_code?: string
    share_url?: string
    sender_id?: string
    sender_name?: string
    [key: string]: unknown
  }
  read: boolean
  created_at: string
}

/**
 * 通知列表状态
 */
const notifications = ref<ShareNotification[]>([])
const unreadCount = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)

/**
 * 获取 Supabase Access Token
 */
async function getAccessToken(): Promise<string | null> {
  try {
    // ✅ 从正确的 storage key 读取 session
    const result = (await chrome.storage.local.get(['supabase.auth.token'])) as {
      'supabase.auth.token'?: string
    }

    const sessionStr = result['supabase.auth.token']
    if (!sessionStr) {
      logger.debug('ShareNotificationService', '未找到 session')
      return null
    }

    // 解析 session JSON
    const session = JSON.parse(sessionStr) as {
      access_token?: string
      currentSession?: { access_token?: string }
    }

    // 尝试从不同的位置获取 access_token
    const accessToken = session.access_token ?? session.currentSession?.access_token ?? null

    if (!accessToken) {
      logger.debug('ShareNotificationService', 'Session 中未找到 access_token')
    }

    return accessToken
  } catch (err) {
    logger.error('ShareNotificationService', '获取 Access Token 失败', err)
    return null
  }
}

/**
 * 获取通知列表
 */
async function fetchNotifications(options?: {
  unreadOnly?: boolean
  limit?: number
  offset?: number
}): Promise<void> {
  try {
    isLoading.value = true
    error.value = null

    const accessToken = await getAccessToken()
    if (!accessToken) {
      throw new Error('用户未登录')
    }

    const result = await trpc.share.getNotifications.query({
      accessToken,
      unreadOnly: options?.unreadOnly ?? false,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0
    })

    if (!result.success) {
      throw new Error('获取通知列表失败')
    }

    notifications.value = result.data as ShareNotification[]
    logger.info('ShareNotificationService', '通知列表已加载', {
      count: notifications.value.length
    })
  } catch (err) {
    error.value = (err as Error).message
    logger.error('ShareNotificationService', '获取通知列表失败', err)
  } finally {
    isLoading.value = false
  }
}

/**
 * 获取未读通知数量
 */
async function fetchUnreadCount(): Promise<void> {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      unreadCount.value = 0
      return
    }

    const result = await trpc.share.getUnreadCount.query({ accessToken })

    if (!result.success) {
      throw new Error('获取未读数量失败')
    }

    // ✅ 修复：count 为 0 是正常情况，不是错误
    unreadCount.value = result.data.count ?? 0
    logger.info('ShareNotificationService', '未读数量已更新', { count: unreadCount.value })
  } catch (err) {
    // ✅ 修复：网络错误时不显示错误提示，只记录日志
    logger.warn('ShareNotificationService', '获取未读数量失败（可能未登录或网络问题）', err)
    // 保持当前值，不重置为 0
  }
}

/**
 * 标记通知为已读
 */
async function markAsRead(notificationId: string): Promise<void> {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      throw new Error('用户未登录')
    }

    const result = await trpc.share.markNotificationAsRead.mutate({
      notificationId,
      accessToken
    })

    if (!result.success) {
      throw new Error('标记通知失败')
    }

    // 更新本地状态
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
    }

    // 更新未读数量
    await fetchUnreadCount()

    logger.info('ShareNotificationService', '通知已标记为已读', { notificationId })
  } catch (err) {
    logger.error('ShareNotificationService', '标记通知失败', err)
    throw err
  }
}

/**
 * 打开通知对应的分享页面
 */
function openNotification(notification: ShareNotification): void {
  try {
    // 标记为已读
    if (!notification.read) {
      markAsRead(notification.id)
    }

    // 打开分享链接
    if (notification.data?.share_url) {
      chrome.tabs.create({ url: notification.data.share_url })
      logger.info('ShareNotificationService', '已打开分享链接', {
        notificationId: notification.id,
        shareUrl: notification.data.share_url
      })
    }
  } catch (err) {
    logger.error('ShareNotificationService', '打开通知失败', err)
  }
}

/**
 * 初始化通知服务
 */
async function initialize(): Promise<void> {
  await Promise.all([fetchNotifications({ unreadOnly: false, limit: 20 }), fetchUnreadCount()])
}

/**
 * 分享通知服务
 */
export const shareNotificationService = {
  // 状态
  notifications: computed(() => notifications.value),
  unreadCount: computed(() => unreadCount.value),
  isLoading: computed(() => isLoading.value),
  error: computed(() => error.value),

  // 方法
  initialize,
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  openNotification
}
