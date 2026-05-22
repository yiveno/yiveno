/**
 * Chrome 消息到事件总线的桥接
 *
 * 职责：
 * - 监听 chrome.runtime.onMessage
 * - 将消息转换为类型安全的事件总线事件
 * - 统一管理所有 Chrome 消息处理
 */

import { emitEvent } from './event-bus'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Chrome 消息类型定义
 */
interface ChromeMessage {
  type: string
  [key: string]: unknown
}

/**
 * 初始化 Chrome 消息监听器
 *
 * 应在应用启动时调用一次
 *
 * @example
 * ```typescript
 * // main.ts
 * import { initializeChromeMessageBridge } from '@/infrastructure/events/chrome-message-bridge'
 *
 * initializeChromeMessageBridge()
 * ```
 */
export function initializeChromeMessageBridge() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    logger.warn('ChromeMessageBridge', 'Chrome runtime 不可用，跳过消息桥接初始化')
    return
  }

  logger.info('ChromeMessageBridge', '🔗 初始化 Chrome 消息桥接')

  chrome.runtime.onMessage.addListener((message: ChromeMessage, _sender, _sendResponse) => {
    handleChromeMessage(message)

    // Chrome 消息处理器要求返回 false（不需要异步响应）
    return false
  })

  logger.info('ChromeMessageBridge', '✅ Chrome 消息桥接已启动')
}

/**
 * 处理 Chrome 消息并转换为事件
 */
function handleChromeMessage(message: ChromeMessage) {
  const { type } = message

  logger.debug('ChromeMessageBridge', `收到消息: ${type}`, message)

  switch (type) {
    /**
     * 数据同步完成消息
     * （从 Background Script 同步到 IndexedDB）
     */
    case 'acuity-bookmarks-db-synced': {
      const { eventType, bookmarkId, timestamp } = message

      const isExternalChange = ['created', 'changed', 'moved', 'removed'].includes(
        String(eventType)
      )

      if (isExternalChange) {
        emitEvent('data:synced', {
          eventType: eventType as 'created' | 'changed' | 'moved' | 'removed',
          bookmarkId: String(bookmarkId),
          timestamp: Number(timestamp ?? Date.now())
        })
        logger.info('ChromeMessageBridge', `✅ 外部变更事件已转发: ${eventType}`)
      } else {
        logger.debug('ChromeMessageBridge', `忽略内部同步事件: ${eventType}`)
      }
      break
    }

    /**
     * 书签更新通知
     * 仅处理 changed 事件，其他事件通过 acuity-bookmarks-db-synced 处理
     */
    case 'BOOKMARK_UPDATED': {
      const { id, eventType, payload } = message

      if (eventType === 'changed') {
        const changes =
          payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>)
            : ({} as Record<string, unknown>)

        emitEvent('bookmark:updated', {
          id: String(id),
          changes
        })
      }
      break
    }

    // ✅ FAVORITE_CHANGED 已移除
    // 跨页面收藏同步现在通过 chrome.storage.session 实现
    // 各页面使用 useCrossPageSync composable 监听并更新 Pinia Store

    default:
      // 未识别的消息类型
      logger.debug('ChromeMessageBridge', `未处理的消息类型: ${type}`)
  }
}

/**
 * 发送消息到 Background Script
 *
 * @param message - 消息对象
 * @returns Promise<响应>
 *
 * @example
 * ```typescript
 * const response = await sendToBackground({
 *   type: 'CREATE_BOOKMARK',
 *   data: { title: '新书签' }
 * })
 * ```
 */
export async function sendToBackground<T = unknown>(message: ChromeMessage): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    throw new Error('Chrome runtime 不可用')
  }

  try {
    const response = await chrome.runtime.sendMessage(message)
    return response as T
  } catch (error) {
    logger.error('ChromeMessageBridge', '发送消息失败', error)
    throw error
  }
}
