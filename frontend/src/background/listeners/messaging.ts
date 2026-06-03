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
import { openManagementPage, openSettingsPage } from '../managers/navigation'
import { getExtensionState } from '../managers/state'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { showSystemNotification, clearSystemNotification } from './notification'
import { autoAddBookmark } from '../managers/auto-add-bookmark'
import { getFolderRecommendations } from '../managers/folder-recommendation'
import { folderVectorService } from '@/application/folder/folder-vector-service'
import { favoriteAppService } from '@/application/bookmark/favorite-app-service'

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
  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    void handleMessage(message, sendResponse)
    return true
  })

  // 监听来自外部网页的消息（官网）
  chrome.runtime.onMessageExternal.addListener((message: RuntimeMessage, sender, sendResponse) => {
    logger.info('BackgroundMessaging', '📨 收到外部消息', {
      type: message.type,
      origin: sender.origin,
      url: sender.url
    })

    // 只接受来自官网的消息
    const allowedOrigins = [
      'https://ottersage.com',
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
  })
}

/**
 * 消息处理器映射
 * 将消息类型映射到对应的处理函数
 */
const MESSAGE_HANDLERS: Record<
  string,
  (message: RuntimeMessage, sendResponse: AsyncResponse) => Promise<void>
> = {
  OTTERSAGE_NOTIFY_PING: async (_message, sendResponse) => {
    sendResponse({ ok: true } as unknown)
  },
  OTTERSAGE_NOTIFY: handleNotification,
  OTTERSAGE_NOTIFY_CLEAR: handleNotificationClear,
  OPEN_MANAGEMENT_PAGE: async (_message, sendResponse) => {
    openManagementPage()
    sendResponse({ success: true } as unknown)
  },
  OPEN_SETTINGS_PAGE: async (_message, sendResponse) => {
    openSettingsPage()
    sendResponse({ success: true } as unknown)
  },
  SYNC_BOOKMARKS: async (_message, sendResponse) => {
    sendResponse({ ok: true } as unknown)
  },
  'get-paged': handlePagedBookmarks,
  'get-children-paged': handleChildrenPaged,
  'get-tree-root': handleTreeRoot,
  'get-global-stats': handleGlobalStats,
  CREATE_BOOKMARK: handleCreateBookmark,
  CREATE_FOLDER: handleCreateFolder,
  UPDATE_BOOKMARK: handleUpdateBookmark,
  DELETE_BOOKMARK: handleDeleteBookmark,
  MOVE_BOOKMARK: handleMoveBookmark,
  REMOVE_TREE_BOOKMARK: handleRemoveTreeBookmark,
  GET_BOOKMARK_TREE: async (message, sendResponse) => {
    logger.info('BackgroundMessaging', '📥 收到 GET_BOOKMARK_TREE 请求')
    await handleGetBookmarkTree(message, sendResponse)
  },
  GET_FOLDER_RECOMMENDATIONS: handleGetFolderRecommendations,
  SYNC_FOLDER_VECTORS: handleSyncFolderVectors,
  CHECK_DUPLICATE_BOOKMARK: handleCheckDuplicateBookmark,
  ADD_TO_FAVORITES: handleAddToFavorites,
  AUTO_ADD_BOOKMARK: handleAutoAddBookmark,
  FAVORITE_CHANGED: async (message, sendResponse) => {
    await broadcastToAllTabs(message)
    sendResponse({ ok: true } as unknown)
  },
  PROXY_API_REQUEST: handleProxyApiRequest,
  BATCH_DELETE_BY_TRAIT: handleBatchDeleteByTrait,
  CHECK_EXTENSION_INSTALLED: async (_message, sendResponse) => {
    sendResponse({
      installed: true,
      version: chrome.runtime.getManifest().version
    } as unknown)
  },
  SYNC_AUTH_SESSION: handleSyncAuthSession,
  CLEAR_AUTH_SESSION: handleClearAuthSession,
  IMPORT_SHARED_BOOKMARKS: async (message, sendResponse) => {
    logger.info('BackgroundMessaging', '📥 收到 IMPORT_SHARED_BOOKMARKS 请求')
    try {
      const bookmarks = message.data?.bookmarks as Array<{ title: string; url: string }> | undefined
      if (!bookmarks || !Array.isArray(bookmarks) || bookmarks.length === 0) {
        sendResponse({ success: false, error: '没有书签数据' })
        return
      }

      // 获取书签栏根目录 ID
      const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => {
        chrome.bookmarks.getTree((t) => resolve(t))
      })
      const bookmarkBar = tree[0]?.children?.[0]
      const parentId = bookmarkBar?.id || '1'

      let ok = 0, fail = 0
      for (const bm of bookmarks) {
        try {
          await new Promise<void>((res, rej) => {
            chrome.bookmarks.create({ parentId, title: bm.title, url: bm.url }, () => {
              chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
            })
          })
          ok++
        } catch (e) {
          fail++
          logger.error('BackgroundMessaging', '导入书签失败', { title: bm.title, error: e })
        }
      }
      logger.info('BackgroundMessaging', '✅ 导入完成', { ok, fail })
      sendResponse({ success: true, ok, fail })
    } catch (e) {
      logger.error('BackgroundMessaging', '❌ 导入失败', e)
      sendResponse({ success: false, error: String(e) })
    }
  }
}

/**
 * 处理接收到的消息
 *
 * 根据消息类型路由到对应的处理函数
 *
 * @param message - 接收到的消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleMessage(message: RuntimeMessage, sendResponse: AsyncResponse): Promise<void> {
  const { type } = message

  // ✅ 添加调试日志
  console.log('📨 [BackgroundMessaging] 收到消息', {
    type,
    data: message.data
  })
  logger.info('BackgroundMessaging', '📨 收到消息', { type })

  try {
    const handler = MESSAGE_HANDLERS[type]
    if (handler) {
      await handler(message, sendResponse)
    } else {
      sendResponse({ status: 'noop' })
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
  const title = (data.title as string) || 'otterSage'
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
  const items = await bookmarkSyncService.getChildrenByParentId(parentId, offset, limit)
  sendResponse({ ok: true, value: items })
}

/**
 * 处理获取树根节点消息
 *
 * 带超时保护，避免长时间等待
 *
 * @param _message - 消息对象（未使用）
 * @param sendResponse - 响应回调函数
 */
async function handleTreeRoot(
  _message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
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
 * @param _message - 消息对象（未使用）
 * @param sendResponse - 响应回调函数
 */
async function handleGlobalStats(
  _message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const all = await bookmarkSyncService.getAllBookmarks(999_999, 0)
  const totalBookmarks = all.filter((item: BookmarkRecord) => item.url && !item.isFolder).length
  const totalFolders = all.filter((item: BookmarkRecord) => item.isFolder).length
  sendResponse({ ok: true, value: { totalBookmarks, totalFolders } })
}

/**
 * 处理创建文件夹消息
 *
 * 架构：通过 Background Script 统一处理，确保数据一致性
 * Chrome API → Background → IndexedDB → 广播通知
 *
 * @param message - 消息对象
 * @param sendResponse - 响应回调函数
 */
async function handleCreateFolder(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    const data = message.data || {}
    const title = (data.title as string)?.trim()
    const parentId = data.parentId as string | undefined

    if (!title || title === '') {
      throw new Error('文件夹标题不能为空')
    }

    logger.info('BackgroundMessaging', '创建文件夹', {
      title,
      parentId
    })

    // 1. 调用 Chrome API 创建文件夹（不提供 URL）
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
      chrome.bookmarks.create(
        {
          title,
          ...(parentId !== undefined ? { parentId } : {}),
          ...(typeof data.index === 'number' ? { index: data.index } : {})
        },
        result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        }
      )
    })

    // 注意：Chrome API 创建文件夹后会自动触发 chrome.bookmarks.onCreated 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知

    logger.info('BackgroundMessaging', `✅ 文件夹已创建: ${node.title}`)
    sendResponse({ success: true, folder: node, folderId: node.id })
  } catch (error) {
    logger.error('BackgroundMessaging', '创建文件夹失败', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
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
    const showNotification = data.showNotification !== false // 默认显示通知

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
      parentId,
      showNotification
    })

    // 1. 调用 Chrome API 创建书签
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
      chrome.bookmarks.create(
        {
          title: title || url, // ✅ 如果标题为空，使用 URL
          url, // ✅ 必须提供 URL（否则会创建文件夹）
          ...(parentId !== undefined ? { parentId } : {}),
          ...(typeof data.index === 'number' ? { index: data.index } : {})
        },
        result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        }
      )
    })

    // 注意：Chrome API 创建书签后会自动触发 chrome.bookmarks.onCreated 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info('BackgroundMessaging', `✅ 书签已创建: ${node.title || node.id}`)

    // ✅ 显示系统通知（如果需要）
    if (showNotification) {
      try {
        // 获取文件夹路径
        const folderPath = await getFolderPath(node.id)
        await showBookmarkAddedNotification(node.id, folderPath)
      } catch (error) {
        logger.warn('BackgroundMessaging', '显示通知失败，但不影响书签创建', error)
      }
    }

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
 * 获取书签所在文件夹的路径
 */
export async function getFolderPath(bookmarkId: string): Promise<string> {
  try {
    const node = await chrome.bookmarks.get(bookmarkId)
    if (!node || node.length === 0) return '未知文件夹'

    const bookmark = node[0]
    if (!bookmark || !bookmark.parentId) return '书签栏'

    // 递归获取父级路径
    const path: string[] = []
    let currentId = bookmark.parentId

    while (currentId && currentId !== '0') {
      const parents = await chrome.bookmarks.get(currentId)
      if (parents && parents.length > 0) {
        const parent = parents[0]
        if (parent) {
          path.unshift(parent.title || '未命名')
          currentId = parent.parentId || '0'
        } else {
          break
        }
      } else {
        break
      }
    }

    return path.join(' > ')
  } catch (error) {
    logger.warn('BackgroundMessaging', '获取文件夹路径失败', error)
    return '未知文件夹'
  }
}

/**
 * 显示书签已添加通知（带撤销按钮）
 */
export async function showBookmarkAddedNotification(
  bookmarkId: string,
  folderPath: string
): Promise<void> {
  try {
    const notificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: '✅ 书签已添加',
      message: `已添加到：${folderPath}`,
      buttons: [{ title: '撤销' }, { title: '查看' }],
      requireInteraction: true, // 强制用户交互，确保通知被看到
      priority: 2 // 提高优先级
    })

    logger.info('BackgroundMessaging', '✅ 通知已创建', {
      notificationId,
      bookmarkId,
      folderPath
    })

    // 监听通知按钮点击
    const handleNotificationClick = async (clickedNotificationId: string, buttonIndex?: number) => {
      // 只处理当前通知的点击事件
      if (clickedNotificationId !== notificationId) {
        return
      }

      logger.info('BackgroundMessaging', '📱 通知按钮点击', {
        notificationId,
        buttonIndex
      })

      if (buttonIndex === 0) {
        // 撤销：删除书签
        try {
          await chrome.bookmarks.remove(bookmarkId)
          logger.info('BackgroundMessaging', '✅ 书签已撤销', { bookmarkId })
        } catch (error) {
          logger.error('BackgroundMessaging', '撤销书签失败', error)
        }
      } else if (buttonIndex === 1) {
        // 查看：打开管理页面
        openManagementPage()
      }

      // 清除通知
      await chrome.notifications.clear(notificationId)
    }

    // 监听通知点击事件（使用一次性监听器）
    chrome.notifications.onButtonClicked.addListener(handleNotificationClick)
    chrome.notifications.onClicked.addListener(clickedNotificationId => {
      void handleNotificationClick(clickedNotificationId, undefined)
    })

    // 监听通知关闭事件，清理监听器
    chrome.notifications.onClosed.addListener(closedNotificationId => {
      if (closedNotificationId === notificationId) {
        logger.info('BackgroundMessaging', '📱 通知已关闭', { notificationId })
        // 清理监听器
        chrome.notifications.onButtonClicked.removeListener(handleNotificationClick)
      }
    })
  } catch (error) {
    logger.error('BackgroundMessaging', '显示通知失败', error)
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
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
      chrome.bookmarks.update(
        id,
        {
          ...(typeof data.title === 'string' ? { title: data.title } : {}),
          ...(typeof data.url === 'string' ? { url: data.url } : {})
        },
        result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        }
      )
    })

    // 注意：Chrome API 更新书签后会自动触发 chrome.bookmarks.onChanged 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知
    // 因此此处不需要手动调用同步

    logger.info('BackgroundMessaging', `✅ 书签已更新: ${node.title || node.id}`)
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
 * 处理 AI 自动添加书签
 */
async function handleAutoAddBookmark(
  message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  const data = message.data || {}
  const title = (data.title as string) || ''
  const url = (data.url as string) || ''
  const favIconUrl = data.favIconUrl as string | undefined

  const result = await autoAddBookmark({
    title,
    url,
    ...(favIconUrl ? { favIconUrl } : {})
  })
  sendResponse(result)
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
    const node = await new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
      chrome.bookmarks.move(
        id,
        {
          ...(targetParentId !== undefined ? { parentId: targetParentId } : {}),
          ...(typeof index === 'number' ? { index } : {})
        },
        result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        }
      )
    })

    // 注意：Chrome API 移动书签后会自动触发 chrome.bookmarks.onMoved 事件
    // background/bookmarks.ts 的监听器会自动同步到 IndexedDB 并广播通知

    logger.info('BackgroundMessaging', `✅ 书签已移动: ${node.title || node.id}`)
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
 * @param _message - 消息对象（未使用）
 * @param sendResponse - 响应回调函数
 */
async function handleGetBookmarkTree(
  _message: RuntimeMessage,
  sendResponse: AsyncResponse
): Promise<void> {
  try {
    logger.info('BackgroundMessaging', '🔄 开始获取书签树...')

    const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve, reject) => {
      chrome.bookmarks.getTree(result => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message
          logger.error('BackgroundMessaging', '❌ chrome.bookmarks.getTree 失败', error)
          reject(new Error(error))
        } else {
          logger.info('BackgroundMessaging', '✅ 获取到书签树', {
            rootNodes: result?.length || 0,
            hasChildren: result?.[0]?.children?.length || 0
          })
          resolve(result)
        }
      })
    })

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
function getFolderPathFromRecord(bookmark: BookmarkRecord, allBookmarks: BookmarkRecord[]): string {
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
          folderPath: getFolderPathFromRecord(bookmark, allBookmarks) // 父级路径（兼容旧代码）
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

    // 跳过去重检查（Background Script 无法弹出确认对话框）
    const success = await favoriteAppService.addToFavorites(bookmarkId, true)

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
 * 处理 fetch 错误
 */
function handleFetchError(
  fetchError: unknown,
  url: string
): {
  error: string
  status: number
  isCertError?: boolean
} {
  const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)

  logger.error('BackgroundMessaging', '❌ fetch 失败', {
    error: errorMessage,
    url,
    errorType: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
    stack: fetchError instanceof Error ? fetchError.stack : undefined
  })

  // 检查是否是 CSP 错误
  if (
    errorMessage.includes('CSP') ||
    errorMessage.includes('Content Security Policy') ||
    errorMessage.includes('violates')
  ) {
    logger.error('BackgroundMessaging', '⚠️ Service Worker fetch 被 CSP 阻止！这不应该发生。', {
      url,
      error: errorMessage,
      suggestion: '请检查 manifest.json 中的 host_permissions 是否正确配置'
    })

    return {
      error: `CSP 限制：${errorMessage}。Service Worker 理论上不应该受到 CSP 限制。请检查 manifest.json 中的 host_permissions 配置，并确保扩展已重新加载。`,
      status: 0
    }
  }

  // 检查是否是证书错误（自签名证书）
  const isCertError =
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('ERR_CERT') ||
    errorMessage.includes('certificate') ||
    errorMessage.includes('SSL') ||
    errorMessage.includes('TLS')

  if (isCertError && (url.includes('localhost') || url.includes('127.0.0.1'))) {
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

    return {
      error: `证书错误：Chrome Extension Service Worker 不接受自签名证书。请先手动访问 https://localhost:8787/api/health 并接受证书，或使用 mkcert 生成受信任的本地证书。原错误：${errorMessage}`,
      status: 0,
      isCertError: true
    }
  }

  return {
    error: errorMessage,
    status: 0
  }
}

/**
 * 验证代理请求参数
 *
 * @param data - 请求数据
 * @returns 验证结果
 */
function validateProxyRequest(data: Record<string, unknown>): {
  valid: boolean
  error?: string
} {
  const url = data.url as string
  if (!url) {
    return { valid: false, error: 'URL 为空' }
  }
  return { valid: true }
}

/**
 * 执行代理 fetch 请求
 *
 * @param url - 请求 URL
 * @param method - HTTP 方法
 * @param headers - 请求头
 * @param body - 请求体
 * @returns fetch 响应
 */
async function executeProxyFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<Response> {
  logger.info('BackgroundMessaging', '🔄 代理 API 请求', {
    url,
    method,
    isServiceWorker: typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self,
    hasFetch: typeof fetch !== 'undefined'
  })

  const urlObj = new URL(url)
  const origin = `${urlObj.protocol}//${urlObj.host}`

  logger.info('BackgroundMessaging', '📍 请求详情', {
    origin,
    fullUrl: url,
    method,
    headersKeys: Object.keys(headers)
  })

  return fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body } : {})
  })
}

/**
 * 解析代理响应数据
 *
 * @param response - fetch 响应
 * @returns 解析后的数据
 */
async function parseProxyResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    return await response.json()
  } else if (contentType?.includes('text/')) {
    return await response.text()
  } else {
    return await response.blob()
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

    // 验证参数
    const validation = validateProxyRequest(data)
    if (!validation.valid) {
      sendResponse({ success: false, error: validation.error })
      return
    }

    // 执行请求
    const response = await executeProxyFetch(url, method, headers, body)

    // 解析响应
    const responseData = await parseProxyResponse(response)

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
    const errorResult = handleFetchError(fetchError, (message.data || {}).url as string)
    sendResponse({
      success: false,
      ...errorResult
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

    logger.debug('BackgroundMessaging', `📡 广播消息到 storage: ${message.type}`)
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
      logger.info('BackgroundMessaging', `✅ 没有找到需要删除的 ${traitTag} 书签`)
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
        logger.debug('BackgroundMessaging', `✅ 已删除书签: ${bookmark.title} (${bookmark.id})`)
      } catch (error) {
        failCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`${bookmark.title}: ${errorMsg}`)
        logger.error('BackgroundMessaging', `❌ 删除书签失败: ${bookmark.title}`, error)
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

    const data = message.data as
      | {
          access_token: string
          refresh_token: string
          expires_at: number
          user: Record<string, unknown>
        }
      | undefined

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
 * @param _message - 消息对象（未使用）
 * @param sendResponse - 响应回调函数
 */
async function handleClearAuthSession(
  _message: RuntimeMessage,
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
