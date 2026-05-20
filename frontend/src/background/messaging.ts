/**
 * 消息路由模块
 *
 * 职责：
 * - 接收来自前端页面的 chrome.runtime.sendMessage 请求
 * - 根据消息类型分发到对应的处理器
 * - 处理书签查询、通知、导航等操作
 * - 提供异步响应支持
 */

import { logger } from '@/infrastructure/logging/logger'
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { openManagementPage, openSettingsPage } from './navigation'
import { getExtensionState } from './state'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { showSystemNotification, clearSystemNotification } from './notification'
import { dispatchOffscreenRequest } from '@/infrastructure/offscreen/manager'

/**
 * 运行时消息接口
 */
interface RuntimeMessage {
  /** 消息类型 */
  type: string
  /** 可选的消息数据 */
  data?: Record<string, unknown>
}

/**
 * 异步响应函数类型
 */
type AsyncResponse = (payload: unknown) => void

/**
 * 注册消息处理器
 *
 * 监听 chrome.runtime.onMessage 事件并分发到具体处理函数
 */
export function registerMessageHandlers(): void {
  // 监听来自插件内部的消息
  chrome.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse) => {
      void handleMessage(message, sendResponse)
      return true
    }
  )

  // 监听来自外部网页的消息（官网）
  chrome.runtime.onMessageExternal.addListener(
    (message: RuntimeMessage, sender, sendResponse) => {
      logger.info('BackgroundMessaging', '📨 收到外部消息', {
        type: message.type,
        origin: sender.origin,
        url: sender.url
      })

      // 只接受来自官网的消息
      const allowedOrigins = [
        'https://acuitybookmarks.com',
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:3001',
        'https://localhost:3001'
      ]

      if (sender.origin && allowedOrigins.includes(sender.origin)) {
        void handleMessage(message, sendResponse)
        return true
      } else {
        logger.warn('BackgroundMessaging', '⚠️ 拒绝来自未授权来源的消息', {
          origin: sender.origin
        })
        sendResponse({ success: false, error: 'Unauthorized origin' })
        return false
      }
    }
  )
}

/**
 * 处理接收到的消息
 *
 * 根据消息类型路由到对应的处理函数
 *
 * @param message - 接收到的消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleMessage(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const { type } = message

  // ✅ 添加调试日志
  console.log('📨 [BackgroundMessaging] 收到消息', { type, data: message.data })
  logger.info('BackgroundMessaging', '📨 收到消息', { type })

  try {
    switch (type) {
      case 'ACUITY_NOTIFY_PING': {
        sendResponse({ ok: true })
        return
      }
      case 'ACUITY_NOTIFY': {
        await handleNotification(message, sendResponse)
        return
      }
      case 'ACUITY_NOTIFY_CLEAR': {
        await handleNotificationClear(message, sendResponse)
        return
      }
      case 'OPEN_MANAGEMENT_PAGE': {
        openManagementPage()
        sendResponse({ success: true })
        return
      }
      case 'OPEN_SETTINGS_PAGE': {
        openSettingsPage()
        sendResponse({ success: true })
        return
      }
      case 'SYNC_BOOKMARKS': {
        sendResponse({ ok: true })
        return
      }
      case 'get-bookmarks-paged': {
        await handlePagedBookmarks(message, sendResponse)
        return
      }
      case 'get-children-paged': {
        await handleChildrenPaged(message, sendResponse)
        return
      }
      case 'get-tree-root': {
        await handleTreeRoot(sendResponse)
        return
      }
      case 'get-global-stats': {
        await handleGlobalStats(sendResponse)
        return
      }
      case 'CREATE_BOOKMARK': {
        await handleCreateBookmark(message, sendResponse)
        return
      }
      case 'UPDATE_BOOKMARK': {
        await handleUpdateBookmark(message, sendResponse)
        return
      }
      case 'DELETE_BOOKMARK': {
        await handleDeleteBookmark(message, sendResponse)
        return
      }
      case 'MOVE_BOOKMARK': {
        await handleMoveBookmark(message, sendResponse)
        return
      }
      case 'REMOVE_TREE_BOOKMARK': {
        await handleRemoveTreeBookmark(message, sendResponse)
        return
      }
      case 'GET_BOOKMARK_TREE': {
        logger.info('BackgroundMessaging', '📥 收到 GET_BOOKMARK_TREE 请求')
        await handleGetBookmarkTree(sendResponse)
        return
      }
      case 'GET_FOLDER_RECOMMENDATIONS': {
        await handleGetFolderRecommendations(message, sendResponse)
        return
      }
      case 'SYNC_FOLDER_VECTORS': {
        await handleSyncFolderVectors(message, sendResponse)
        return
      }
      case 'CHECK_DUPLICATE_BOOKMARK': {
        await handleCheckDuplicateBookmark(message, sendResponse)
        return
      }
      case 'ADD_TO_FAVORITES': {
        await handleAddToFavorites(message, sendResponse)
        return
      }
      case 'FAVORITE_CHANGED': {
        // 广播收藏变更到所有页面
        await broadcastToAllTabs(message)
        sendResponse({ ok: true })
        return
      }
      case 'PROXY_API_REQUEST': {
        await handleProxyApiRequest(message, sendResponse)
        return
      }
      case 'BATCH_DELETE_BY_TRAIT': {
        await handleBatchDeleteByTrait(message, sendResponse)
        return
      }
      case 'CHECK_EXTENSION_INSTALLED': {
        // 简单的 ping 响应，用于网页检测扩展是否安装
        sendResponse({ installed: true, version: chrome.runtime.getManifest().version })
        return
      }
      case 'GET_CURRENT_USER': {
        // 获取当前登录用户信息（从 Chrome Storage）
        await handleGetCurrentUser(sendResponse)
        return
      }
      case 'IMPORT_SHARED_BOOKMARKS': {
        // 从官网导入分享的书签
        await handleImportSharedBookmarks(message, sendResponse)
        return
      }
      case 'SYNC_AUTH_SESSION': {
        await handleSyncAuthSession(message, sendResponse)
        return
      }
      case 'CLEAR_AUTH_SESSION': {
        await handleClearAuthSession(sendResponse)
        return
      }
      case 'TRIGGER_DATA_INTEGRITY_CHECK': {
        // 手动触发数据完整性检查（用于测试和调试）
        await handleTriggerDataIntegrityCheck(sendResponse)
        return
      }
      default: {
        sendResponse({ status: 'noop' })
      }
    }
  } catch (error) {
    logger.error('BackgroundMessaging', `处理消息 ${type} 失败`, error)
    sendResponse({ status: 'error', message: String(error) })
  }
}

/**
 * 处理通知消息
 *
 * 创建 Chrome 系统通知
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleNotification(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const data = message.data || {}
  const title = (data.title as string) || 'AcuityBookmarks'
  const content = (data.message as string) || ''
  const iconUrl = data.iconUrl as string | undefined

  const notificationId = await showSystemNotification(content, {
    title,
    iconUrl
  })

  sendResponse({ notificationId })
}

/**
 * 处理清除通知消息
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleNotificationClear(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const id = message.data?.notificationId as string | undefined
  if (id) {
    await clearSystemNotification(id)
  }
  sendResponse({ ok: true })
}

/**
 * 处理分页获取书签消息
 *
 * @param message - 消息对象（包含 limit 和 offset）
 * @param sendResponse - 响应回调函数
 */
async function handlePagedBookmarks(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const limit = Number(message.data?.limit ?? 100)
  const offset = Number(message.data?.offset ?? 0)
  const items = await bookmarkSyncService.getAllBookmarks(limit, offset)
  sendResponse({
    ok: true,
    value: { items, limit, offset, total: items.length }
  })
}

/**
 * 处理分页获取子节点消息
 *
 * @param message - 消息对象（包含 parentId、limit 和 offset）
 * @param sendResponse - 响应回调函数
 */
async function handleChildrenPaged(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const parentId = String(message.data?.parentId ?? '')
  const limit = Number(message.data?.limit ?? 100)
  const offset = Number(message.data?.offset ?? 0)
  const items = await bookmarkSyncService.getChildrenByParentId(
    parentId,
    offset,
    limit
  )
  sendResponse({ ok: true, value: items })
}

/**
 * 处理获取树根节点消息
 *
 * 带超时保护，避免长时间等待
 *
 * @param sendResponse - 响应回调函数
 */
async function handleTreeRoot(sendResponse: AsyncResponse): Promise<void> {
  let responded = false

  const done = (payload: unknown) => {
    if (responded) return
    responded = true
    sendResponse(payload)
  }

  const failFastTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
    logger.warn('BackgroundMessaging', 'get-tree-root 超时，返回空数组')
    done({ ok: true, value: [], meta: { failFast: true } })
  }, 2000)

  try {
    const state = await getExtensionState()
    if (!state.dbReady) {
      clearTimeout(failFastTimer)
      done({ ok: true, value: [], meta: { notReady: true } })
      return
    }

    const items = await bookmarkSyncService.getRootBookmarks()
    clearTimeout(failFastTimer)
    done({ ok: true, value: items })
  } catch (error) {
    clearTimeout(failFastTimer)
    throw error
  }
}

/**
 * 处理获取全局统计数据消息
 *
 * @param sendResponse - 响应回调函数
 */
async function handleGlobalStats(sendResponse: AsyncResponse): Promise<void> {
  const all = await bookmarkSyncService.getAllBookmarks(999_999, 0)
  const totalBookmarks = all.filter(
    (item: BookmarkRecord) => item.url && !item.isFolder
  ).length
  const totalFolders = all.filter(
    (item: BookmarkRecord) => item.isFolder
  ).length
  sendResponse({ ok: true, value: { totalBookmarks, totalFolders } })
}

/**
 * 处理创建书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 * Chrome API → Background → IndexedDB → 广播通知
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleCreateBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}

    // ✅ 严格验证数据（防止创建文件夹而不是书签）
    const title = (data.title as string)?.trim()
    const url = (data.url as string)?.trim()
    const parentId = data.parentId as string | undefined

    if (!url || url === '') {
      const error = '❌ 无法创建书签：URL 为空或未定义'
      logger.error('BackgroundMessaging', error, data)
      sendResponse({ success: false, error })
      return
    }

    if (!title || title === '') {
      logger.warn('BackgroundMessaging', '标题为空，使用 URL 作为标题')
    }

    logger.info('BackgroundMessaging', '创建书签', {
      title: title || url,
      url,
      parentId
    })

    // 1. 调用 Chrome API 创建书签
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.create(
          {
            title: title || url, // ✅ 如果标题为空，使用 URL
            url, // ✅ 必须提供 URL（否则会创建文件夹）
            parentId,
            index: data.index as number | undefined
          },
          result => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          }
        )
      }
    )

    // 注意：Chrome API 创建书签后会自动触发 chrome.bookmarks.onCreated 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info(
      'BackgroundMessaging',
      `✅ 书签已创建: ${node.title || node.id}`
    )
    sendResponse({ success: true, bookmark: node, bookmarkId: node.id })
  } catch (error) {
    logger.error('BackgroundMessaging', '创建书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理更新书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleUpdateBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const id = data.id as string

    if (!id) {
      throw new Error('缺少书签 ID')
    }

    // 1. 调用 Chrome API 更新书签
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.update(
          id,
          {
            title: data.title as string | undefined,
            url: data.url as string | undefined
          },
          result => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          }
        )
      }
    )

    // 注意：Chrome API 更新书签后会自动触发 chrome.bookmarks.onChanged 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info(
      'BackgroundMessaging',
      `✅ 书签已更新: ${node.title || node.id}`
    )
    sendResponse({ success: true, bookmark: node })
  } catch (error) {
    logger.error('BackgroundMessaging', '更新书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理删除书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleDeleteBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const id = data.id as string

    if (!id) {
      throw new Error('缺少书签 ID')
    }

    // 1. 调用 Chrome API 删除书签
    await new Promise<void>((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })

    // 注意：Chrome API 删除书签后会自动触发 chrome.bookmarks.onRemoved 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info('BackgroundMessaging', `✅ 书签已删除: ${id}`)
    sendResponse({ success: true })
  } catch (error) {
    logger.error('BackgroundMessaging', '删除书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理移动书签消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleMoveBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const id = data.id as string
    const parentId = data.parentId as string | undefined
    const index = data.index as number | undefined

    if (!id) {
      throw new Error('缺少书签 ID')
    }

    // ✅ 处理 parentId（root 需要转换为 undefined）
    let targetParentId: string | undefined = parentId
    if (targetParentId === 'root' || targetParentId === 'virtual-root') {
      targetParentId = undefined
    }

    // 1. 调用 Chrome API 移动书签
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.move(
          id,
          {
            parentId: targetParentId,
            index
          },
          result => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          }
        )
      }
    )

    // 注意：Chrome API 移动书签后会自动触发 chrome.bookmarks.onMoved 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知

    logger.info(
      'BackgroundMessaging',
      `✅ 书签已移动: ${node.title || node.id}`
    )
    sendResponse({ success: true, bookmark: node })
  } catch (error) {
    logger.error('BackgroundMessaging', '移动书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理删除文件夹（递归删除）消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleRemoveTreeBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const id = data.id as string

    if (!id) {
      throw new Error('缺少书签 ID')
    }

    // 1. 调用 Chrome API 删除文件夹（递归删除）
    await new Promise<void>((resolve, reject) => {
      chrome.bookmarks.removeTree(id, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })

    // 注意：Chrome API 删除文件夹后会自动触发 chrome.bookmarks.onRemoved 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 同时会自动清理每个被删除书签的爬取元数据

    logger.info('BackgroundMessaging', `✅ 文件夹已删除（递归）: ${id}`)
    sendResponse({ success: true })
  } catch (error) {
    logger.error('BackgroundMessaging', '删除文件夹失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理获取书签树请求
 *
 * 返回 Chrome 原生的书签树结构（用于文件夹选择）
 *
 * @param sendResponse - 响应回调函数
 */
async function handleGetBookmarkTree(
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    logger.info('BackgroundMessaging', '🔄 开始获取书签树...')

    const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getTree(result => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message
            logger.error(
              'BackgroundMessaging',
              '❌ chrome.bookmarks.getTree 失败',
              error
            )
            reject(new Error(error))
          } else {
            logger.info('BackgroundMessaging', '✅ 获取到书签树', {
              rootNodes: result?.length || 0,
              hasChildren: result?.[0]?.children?.length || 0
            })
            resolve(result)
          }
        })
      }
    )

    logger.info('BackgroundMessaging', '📤 发送书签树响应', {
      success: true,
      treeLength: tree.length
    })

    sendResponse({
      success: true,
      tree
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 获取书签树失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理获取文件夹推荐请求（导出供 menus.ts 直接调用）
 *
 * 根据书签标题和 URL 推荐合适的文件夹
 *
 * @param title 书签标题
 * @param url 书签 URL
 * @param topK 返回数量
 * @param minScore 最低相似度阈值
 */
export async function getFolderRecommendations(
  title: string,
  url: string,
  topK = 3,
  minScore = 0.3
): Promise<Array<{
  folderId: string
  folderName: string
  folderPath: string
  score: number
  bookmarkCount: number
  reason: string
}>> {
  try {
    if (!title || !url) {
      logger.error('BackgroundMessaging', '❌ 标题和 URL 不能为空', { title, url })
      return []
    }

    logger.info('BackgroundMessaging', '🔍 获取文件夹推荐 - 开始', {
      title,
      url: url.substring(0, 50),
      topK,
      minScore
    })

    // ✅ 使用 offscreen 文档来执行向量计算（避免在 Service Worker 中导入可能包含 DOM API 的模块）
    try {
      logger.info('BackgroundMessaging', '📤 发送请求到 Offscreen Document...')
      
      const result = await dispatchOffscreenRequest({
        type: 'GET_FOLDER_RECOMMENDATIONS',
        payload: {
          title,
          url,
          topK,
          minScore
        }
      })

      logger.info('BackgroundMessaging', '📥 收到 Offscreen 响应', {
        resultType: typeof result,
        isArray: Array.isArray(result),
        length: Array.isArray(result) ? result.length : 0
      })

      if (result && Array.isArray(result)) {
        logger.info('BackgroundMessaging', '✅ 文件夹推荐完成', {
          count: result.length,
          recommendations: result
        })

        return result as Array<{
          folderId: string
          folderName: string
          folderPath: string
          score: number
          bookmarkCount: number
          reason: string
        }>
      } else {
        logger.error('BackgroundMessaging', '❌ Offscreen 返回的结果格式不正确', {
          result
        })
        throw new Error('Offscreen 返回的结果格式不正确')
      }
    } catch (offscreenError) {
      logger.warn(
        'BackgroundMessaging',
        '⚠️ Offscreen 推荐失败，降级到简单推荐',
        {
          error: offscreenError instanceof Error ? offscreenError.message : String(offscreenError),
          stack: offscreenError instanceof Error ? offscreenError.stack : undefined
        }
      )

      // 降级方案：返回书签栏作为默认推荐
      logger.info('BackgroundMessaging', '📁 使用降级方案：返回书签栏')
      const tree = await chrome.bookmarks.getTree()
      const bookmarksBar = tree[0]?.children?.find(
        node => node.title === '书签栏' || node.title === 'Bookmarks Bar'
      )

      if (bookmarksBar) {
        logger.info('BackgroundMessaging', '✅ 找到书签栏', {
          id: bookmarksBar.id,
          title: bookmarksBar.title
        })
        return [
          {
            folderId: bookmarksBar.id,
            folderName: bookmarksBar.title,
            folderPath: bookmarksBar.title,
            score: 0.5,
            bookmarkCount: bookmarksBar.children?.length || 0,
            reason: '默认推荐（书签栏）'
          }
        ]
      } else {
        logger.error('BackgroundMessaging', '❌ 未找到书签栏')
        return []
      }
    }
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 获取文件夹推荐失败', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return []
  }
}

/**
 * 处理获取文件夹推荐请求
 *
 * 根据书签标题和 URL 推荐合适的文件夹
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleGetFolderRecommendations(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const data = message.data || {}
  const title = (data.title as string) || ''
  const url = (data.url as string) || ''
  const topK = (data.topK as number) || 3
  const minScore = (data.minScore as number) || 0.3

  const recommendations = await getFolderRecommendations(title, url, topK, minScore)
  
  sendResponse({
    success: true,
    recommendations
  })
}

/**
 * 处理同步文件夹向量请求
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleSyncFolderVectors(
  _message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    logger.info('BackgroundMessaging', '🔄 开始同步文件夹向量')

    // 动态导入文件夹向量服务（使用 webpackChunkName 确保代码分割）
    const { folderVectorService } = await import(
      /* webpackChunkName: "folder-vector-service" */
      /* @vite-ignore */
      '@/application/folder/folder-vector-service'
    )

    await folderVectorService.syncFolderVectors(progress => {
      logger.debug('BackgroundMessaging', '同步进度', progress)
    })

    logger.info('BackgroundMessaging', '✅ 文件夹向量同步完成')

    sendResponse({
      success: true
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 同步文件夹向量失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 获取书签的文件夹路径
 *
 * 直接使用 IndexedDB 中预处理好的 pathString 或 path 字段
 * 如果 pathString 包含书签名称，需要去掉最后一节
 */
function getFolderPath(
  bookmark: BookmarkRecord,
  allBookmarks: BookmarkRecord[]
): string {
  // 优先使用 pathString（完整路径，包括当前节点）
  if (bookmark.pathString) {
    const parts = bookmark.pathString.split(' / ')
    if (parts.length > 1) {
      // 有多节：去掉最后一节（当前书签名称），返回父级路径
      return parts.slice(0, -1).join(' / ')
    }
    // 只有1节：说明 pathString 只包含当前节点名称，需要查找父级
    if (bookmark.parentId) {
      const parent = allBookmarks.find(b => b.id === bookmark.parentId)
      if (parent) {
        // 显示父级文件夹名称
        return parent.title
      }
    }
  }

  // 如果没有 pathString 或只有1节，尝试使用 path 数组
  if (bookmark.path && bookmark.path.length > 0) {
    // path 数组格式：可能包含所有节点（包括当前），也可能只包含父级
    // 检查最后一节是否等于当前书签标题
    const lastPart = bookmark.path[bookmark.path.length - 1]
    if (lastPart === bookmark.title) {
      // 包含当前节点，去掉最后一节
      if (bookmark.path.length > 1) {
        return bookmark.path.slice(0, -1).join(' / ')
      }
      // 只有1节且等于当前标题，查找父级
      if (bookmark.parentId) {
        const parent = allBookmarks.find(b => b.id === bookmark.parentId)
        if (parent) {
          return parent.title
        }
      }
    } else {
      // 不包含当前节点，直接返回
      return bookmark.path.join(' / ')
    }
  }

  // 如果 path 和 pathString 都没有，但有 parentId，查找父级名称
  if (bookmark.parentId) {
    const parent = allBookmarks.find(b => b.id === bookmark.parentId)
    if (parent) {
      return parent.title
    }
  }

  // 最后的降级：确实没有父级信息
  return '未知位置'
}

async function handleCheckDuplicateBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const url = (data.url as string)?.trim()

    if (!url) {
      sendResponse({ success: false, error: 'URL 为空' })
      return
    }

    logger.info('BackgroundMessaging', '🔍 检查 URL 重复', {
      url: url.substring(0, 100)
    })

    // 从 IndexedDB 查询所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    // 检查 URL 重复（忽略大小写，规范化 URL）
    const urlLower = url.toLowerCase().replace(/\/$/, '') // 移除尾部斜杠
    const urlDuplicates = allBookmarks.filter(bookmark => {
      if (!bookmark.url) return false
      const bookmarkUrl = bookmark.url.toLowerCase().replace(/\/$/, '')
      return bookmarkUrl === urlLower
    })

    if (urlDuplicates.length > 0) {
      logger.info('BackgroundMessaging', '✅ 检测到 URL 重复', {
        count: urlDuplicates.length,
        titles: urlDuplicates.map(b => b.title)
      })

      sendResponse({
        success: true,
        exists: true,
        existingBookmarks: urlDuplicates.map(bookmark => ({
          title: bookmark.title,
          url: bookmark.url,
          pathString: bookmark.pathString || '', // 完整的路径字符串
          folderPath: getFolderPath(bookmark, allBookmarks) // 父级路径（兼容旧代码）
        }))
      })
    } else {
      sendResponse({
        success: true,
        exists: false,
        existingBookmarks: []
      })
    }
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 检查 URL 重复失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 添加书签到收藏
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleAddToFavorites(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const bookmarkId = data.bookmarkId as string

    if (!bookmarkId) {
      sendResponse({ success: false, error: '书签 ID 为空' })
      return
    }

    logger.info('BackgroundMessaging', '⭐ 添加到收藏', { bookmarkId })

    // 动态导入收藏服务（避免循环依赖）
    const { favoriteAppService } = await import(
      '@/application/bookmark/favorite-app-service'
    )

    const success = await favoriteAppService.addToFavorites(bookmarkId)

    if (success) {
      logger.info('BackgroundMessaging', '✅ 书签已添加到收藏', { bookmarkId })
      sendResponse({ success: true })
    } else {
      logger.warn('BackgroundMessaging', '⚠️ 添加到收藏失败', { bookmarkId })
      sendResponse({ success: false, error: '添加到收藏失败' })
    }
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 添加到收藏失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 代理 API 请求（绕过 CSP 限制）
 *
 * Background Script 不受 CSP 限制，可以自由访问任何 HTTP/HTTPS 端点
 * 前端页面通过此处理器发送请求，避免 CSP 错误
 *
 * @param message - 消息对象（包含 url、method、headers、body）
 * @param sendResponse - 响应回调函数
 */
async function handleProxyApiRequest(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const url = data.url as string
    const method = (data.method as string) || 'GET'
    const headers = (data.headers as Record<string, string>) || {}
    const body = data.body as string | undefined

    if (!url) {
      sendResponse({ success: false, error: 'URL 为空' })
      return
    }

    logger.info('BackgroundMessaging', '🔄 代理 API 请求', {
      url,
      method,
      // 调试信息：确认这是在 Service Worker 环境中
      isServiceWorker:
        typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self,
      hasFetch: typeof fetch !== 'undefined'
    })

    // Service Worker 应该不受 CSP 限制，只要有 host_permissions
    // 但为了调试，我们先检查 URL 是否在 host_permissions 中
    const urlObj = new URL(url)
    const origin = `${urlObj.protocol}//${urlObj.host}`

    logger.info('BackgroundMessaging', '📍 请求详情', {
      origin,
      fullUrl: url,
      method,
      headersKeys: Object.keys(headers)
    })

    try {
      const response = await fetch(url, {
        method,
        headers,
        body
      })

      const contentType = response.headers.get('content-type')
      let responseData: unknown

      if (contentType?.includes('application/json')) {
        responseData = await response.json()
      } else if (contentType?.includes('text/')) {
        responseData = await response.text()
      } else {
        responseData = await response.blob()
      }

      logger.info('BackgroundMessaging', '✅ 代理 API 请求成功', {
        url,
        status: response.status
      })

      sendResponse({
        success: true,
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries())
      })
    } catch (fetchError) {
      // 如果 fetch 失败，记录详细错误信息
      const errorMessage =
        fetchError instanceof Error ? fetchError.message : String(fetchError)

      logger.error('BackgroundMessaging', '❌ fetch 失败', {
        error: errorMessage,
        url,
        errorType:
          fetchError instanceof Error
            ? fetchError.constructor.name
            : typeof fetchError,
        stack: fetchError instanceof Error ? fetchError.stack : undefined
      })

      // 检查是否是 CSP 错误
      if (
        errorMessage.includes('CSP') ||
        errorMessage.includes('Content Security Policy') ||
        errorMessage.includes('violates')
      ) {
        logger.error(
          'BackgroundMessaging',
          '⚠️ Service Worker fetch 被 CSP 阻止！这不应该发生。',
          {
            url,
            error: errorMessage,
            suggestion:
              '请检查 manifest.json 中的 host_permissions 是否正确配置'
          }
        )

        sendResponse({
          success: false,
          error: `CSP 限制：${errorMessage}。Service Worker 理论上不应该受到 CSP 限制。请检查 manifest.json 中的 host_permissions 配置，并确保扩展已重新加载。`,
          status: 0
        })
      } else {
        // 检查是否是证书错误（自签名证书）
        const isCertError =
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('ERR_CERT') ||
          errorMessage.includes('certificate') ||
          errorMessage.includes('SSL') ||
          errorMessage.includes('TLS')

        if (
          isCertError &&
          (url.includes('localhost') || url.includes('127.0.0.1'))
        ) {
          logger.error(
            'BackgroundMessaging',
            '⚠️ 自签名证书错误：Chrome Extension Service Worker 不接受自签名证书',
            {
              url,
              error: errorMessage,
              solution:
                '请先手动访问 https://localhost:8787/api/health 并接受证书，或使用 mkcert 生成受信任的本地证书'
            }
          )

          sendResponse({
            success: false,
            error: `证书错误：Chrome Extension Service Worker 不接受自签名证书。请先手动访问 https://localhost:8787/api/health 并接受证书，或使用 mkcert 生成受信任的本地证书。原错误：${errorMessage}`,
            status: 0,
            isCertError: true
          })
        } else {
          sendResponse({
            success: false,
            error: errorMessage,
            status: 0
          })
        }
      }
    }
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 代理 API 请求失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      status: 0
    })
  }
}

/**
 * 广播消息到所有页面（包括扩展页面和标签页）
 * 使用 chrome.storage.session 作为事件通道，所有扩展页面监听存储变化
 * @param message 要广播的消息
 */
async function broadcastToAllTabs(message: RuntimeMessage): Promise<void> {
  try {
    // 使用 session storage 作为跨页面事件通道
    // 扩展页面监听 chrome.storage.onChanged 来接收事件
    await chrome.storage.session.set({
      __favoriteEvent: {
        ...message,
        timestamp: Date.now()
      }
    })

    logger.debug(
      'BackgroundMessaging',
      `📡 广播消息到 storage: ${message.type}`
    )
  } catch (error) {
    logger.debug('BackgroundMessaging', '广播消息失败', error)
  }
}

/**
 * 批量删除指定特征标签的书签
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 * 1. 从 IndexedDB 查询所有符合条件的书签
 * 2. 逐个调用 Chrome API 删除
 * 3. Chrome API 会自动触发 onRemoved 事件，同步到 IndexedDB
 *
 * @param message - 消息对象（包含 traitTag: 'duplicate' | 'invalid'）
 * @param sendResponse - 响应回调函数
 */
async function handleBatchDeleteByTrait(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const traitTag = data.traitTag as string

    if (!traitTag) {
      sendResponse({ success: false, error: '缺少特征标签' })
      return
    }

    logger.info('BackgroundMessaging', `🗑️ 开始批量删除 ${traitTag} 书签`)

    // 1. 从 IndexedDB 查询所有符合条件的书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const bookmarksToDelete = allBookmarks.filter(
      bookmark =>
        bookmark.url && // 只删除书签，不删除文件夹
        bookmark.traitTags &&
        bookmark.traitTags.includes(traitTag)
    )

    if (bookmarksToDelete.length === 0) {
      logger.info(
        'BackgroundMessaging',
        `✅ 没有找到需要删除的 ${traitTag} 书签`
      )
      sendResponse({ success: true, count: 0 })
      return
    }

    logger.info('BackgroundMessaging', `📋 找到 ${bookmarksToDelete.length} 个 ${traitTag} 书签`)

    // 2. 逐个删除书签（使用 Chrome API）
    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const bookmark of bookmarksToDelete) {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.bookmarks.remove(bookmark.id, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve()
            }
          })
        })
        successCount++
        logger.debug(
          'BackgroundMessaging',
          `✅ 已删除书签: ${bookmark.title} (${bookmark.id})`
        )
      } catch (error) {
        failCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`${bookmark.title}: ${errorMsg}`)
        logger.error(
          'BackgroundMessaging',
          `❌ 删除书签失败: ${bookmark.title}`,
          error
        )
      }
    }

    // 3. 返回结果
    logger.info('BackgroundMessaging', `✅ 批量删除完成`, {
      total: bookmarksToDelete.length,
      success: successCount,
      failed: failCount
    })

    sendResponse({
      success: true,
      count: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 批量删除失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理同步认证 session 消息
 * 
 * 从 Content Script 接收官网的 Supabase session，存储到 Chrome Storage
 * 
 * @param message - 消息对象（包含 access_token、refresh_token、expires_at、user）
 * @param sendResponse - 响应回调函数
 */
async function handleSyncAuthSession(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    console.log('[BackgroundMessaging] 📨 收到 SYNC_AUTH_SESSION 消息')
    console.log('[BackgroundMessaging] message.data:', message.data)
    
    const data = message.data as {
      access_token: string
      refresh_token: string
      expires_at: number
      user: Record<string, unknown>
    } | undefined

    if (!data || !data.access_token || !data.refresh_token) {
      console.error('[BackgroundMessaging] ❌ Session 数据不完整:', data)
      logger.error('BackgroundMessaging', '❌ Session 数据不完整', data)
      sendResponse({ success: false, error: 'Session 数据不完整' })
      return
    }

    console.log('[BackgroundMessaging] 🔑 Session 数据完整，开始存储...')
    logger.info('BackgroundMessaging', '🔑 同步 session 到 Chrome Storage', {
      userId: data.user?.id,
      expiresAt: new Date(data.expires_at * 1000).toISOString()
    })

    // 存储到 Chrome Storage Local（持久化）
    const sessionData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user
    }
    
    console.log('[BackgroundMessaging] 准备存储的 session:', {
      hasAccessToken: !!sessionData.access_token,
      hasRefreshToken: !!sessionData.refresh_token,
      userId: sessionData.user?.id
    })
    
    await chrome.storage.local.set({
      'supabase.auth.token': JSON.stringify(sessionData)
    })

    console.log('[BackgroundMessaging] ✅ Session 已存储到 Chrome Storage')
    logger.info('BackgroundMessaging', '✅ Session 已存储到 Chrome Storage')
    sendResponse({ success: true })
  } catch (error) {
    console.error('[BackgroundMessaging] ❌ 同步 session 失败:', error)
    logger.error('BackgroundMessaging', '❌ 同步 session 失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理清除认证 session 消息
 * 
 * 从 Chrome Storage 中删除 Supabase session
 * 
 * @param sendResponse - 响应回调函数
 */
async function handleClearAuthSession(
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    logger.info('BackgroundMessaging', '🧹 清除 Chrome Storage 中的 session')

    await chrome.storage.local.remove('supabase.auth.token')

    logger.info('BackgroundMessaging', '✅ Session 已清除')
    sendResponse({ success: true })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 清除 session 失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}





/**
 * 处理获取当前登录用户信息
 *
 * 从 Chrome Storage 读取 Supabase session，返回用户信息
 *
 * @param sendResponse - 响应回调函数
 */
async function handleGetCurrentUser(
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    // 从 Chrome Storage 读取 session
    const result = await chrome.storage.local.get('supabase.auth.token')
    const sessionJson = result['supabase.auth.token'] as string | undefined

    if (!sessionJson) {
      logger.info('BackgroundMessaging', '📭 未找到登录 session')
      sendResponse({ success: true, user: null })
      return
    }

    const session = JSON.parse(sessionJson) as { 
      user?: { 
        id: string
        email: string
        user_metadata?: { name?: string }
      } 
    }
    
    if (!session.user) {
      logger.warn('BackgroundMessaging', '⚠️ Session 中没有用户信息')
      sendResponse({ success: true, user: null })
      return
    }

    logger.info('BackgroundMessaging', '✅ 获取到当前用户', {
      userId: session.user.id,
      email: session.user.email
    })

    sendResponse({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email
      }
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 获取当前用户失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理从官网导入分享的书签
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 * 1. 接收官网传来的书签数据
 * 2. 逐个调用 Chrome API 创建书签
 * 3. Chrome API 会自动触发 onCreated 事件，同步到 IndexedDB
 *
 * @param message - 消息对象（包含 bookmarks 数组和可选的 targetFolderId）
 * @param sendResponse - 响应回调函数
 */
async function handleImportSharedBookmarks(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const bookmarks = data.bookmarks as Array<{
      title: string
      url: string
      description?: string
    }>
    const shareTitle = (data.shareTitle as string) || '分享的书签'

    if (!bookmarks || !Array.isArray(bookmarks) || bookmarks.length === 0) {
      logger.error('BackgroundMessaging', '❌ 书签数据为空或格式不正确', data)
      sendResponse({
        success: false,
        error: '书签数据为空或格式不正确'
      })
      return
    }

    logger.info('BackgroundMessaging', '📥 开始导入分享的书签', {
      count: bookmarks.length,
      shareTitle
    })

    // 1. 获取书签栏 ID
    const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
      (resolve, reject) => {
        chrome.bookmarks.getTree(result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      }
    )

    // 查找书签栏（Bookmarks Bar / 书签栏）
    const bookmarksBar = tree[0]?.children?.find(
      node => node.title === '书签栏' || node.title === 'Bookmarks Bar'
    )

    if (!bookmarksBar) {
      throw new Error('未找到书签栏')
    }

    logger.info('BackgroundMessaging', '📁 找到书签栏', {
      id: bookmarksBar.id,
      title: bookmarksBar.title
    })

    // 2. 在书签栏中创建一个文件夹（使用分享标题 + 时间戳）
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}`
    const folderName = `${shareTitle} (${timestamp})`

    const folder = await new Promise<chrome.bookmarks.BookmarkTreeNode>(
      (resolve, reject) => {
        chrome.bookmarks.create(
          {
            parentId: bookmarksBar.id,
            title: folderName,
            index: 0 // 放在书签栏的最前面
          },
          result => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          }
        )
      }
    )

    logger.info('BackgroundMessaging', '📁 创建文件夹成功', {
      folderId: folder.id,
      folderName: folder.title
    })

    // 3. 批量创建书签到新文件夹中
    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const bookmark of bookmarks) {
      try {
        // 验证书签数据
        if (!bookmark.url || !bookmark.url.trim()) {
          failCount++
          errors.push(`${bookmark.title || '未命名'}: URL 为空`)
          continue
        }

        // 调用 Chrome API 创建书签
        await new Promise<chrome.bookmarks.BookmarkTreeNode>(
          (resolve, reject) => {
            chrome.bookmarks.create(
              {
                title: bookmark.title || bookmark.url,
                url: bookmark.url,
                parentId: folder.id // ✅ 放到新创建的文件夹中
              },
              result => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else {
                  resolve(result)
                }
              }
            )
          }
        )

        successCount++
        logger.debug(
          'BackgroundMessaging',
          `✅ 已导入书签: ${bookmark.title || bookmark.url}`
        )
      } catch (error) {
        failCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`${bookmark.title || bookmark.url}: ${errorMsg}`)
        logger.error(
          'BackgroundMessaging',
          `❌ 导入书签失败: ${bookmark.title || bookmark.url}`,
          error
        )
      }
    }

    // 返回结果
    logger.info('BackgroundMessaging', '✅ 书签导入完成', {
      total: bookmarks.length,
      success: successCount,
      failed: failCount,
      folderName: folder.title
    })

    sendResponse({
      success: true,
      imported: successCount,
      failed: failCount,
      total: bookmarks.length,
      folderName: folder.title,
      folderId: folder.id,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 导入分享的书签失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 处理手动触发数据完整性检查请求
 *
 * 用于测试和调试，允许前端手动触发检查
 *
 * @param sendResponse - 响应回调函数
 */
async function handleTriggerDataIntegrityCheck(
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    logger.info('BackgroundMessaging', '🔧 手动触发数据完整性检查')

    // 动态导入检查器（避免循环依赖）
    const { triggerManualCheck } = await import('./data-integrity-checker')

    // 异步执行检查（不阻塞响应）
    triggerManualCheck().catch(error => {
      logger.error('BackgroundMessaging', '❌ 手动检查执行失败', error)
    })

    sendResponse({
      success: true,
      message: '数据完整性检查已触发'
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '❌ 触发数据完整性检查失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
