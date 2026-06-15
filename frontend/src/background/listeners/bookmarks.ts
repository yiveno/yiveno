/**
 * 书签变化监听与同步
 *
 * 实现单向数据流架构：
 * Chrome API → Background → IndexedDB → 广播 → UI
 *
 * 架构原则：
 * 1. Background 是唯一监听 Chrome bookmarks 事件的地方
 * 2. 每次事件触发后完整同步到 IndexedDB
 * 3. 同步完成后广播消息给所有前端页面
 * 4. 前端页面监听广播，从 IndexedDB 刷新 UI
 *
 * @see /单向数据流架构说明.md
 */

import { logger } from '@/infrastructure/logging/logger'
import { isBookmarkSyncBatchSuspended } from '@/core/bookmark/bookmark-sync-batch'
import { bookmarkSyncService } from '@/infrastructure/services/bookmark-sync-service'
import { scheduleRetrievalProfileSync } from '@/background/managers/retrieval-profile-sync'
import { scheduleBookmarkEmbeddingSync } from '@/background/managers/embedding-sync'
// ⚠️ 临时注释：scheduleTraitRebuildForIds 导致 background.js 导入 app-components
// import { scheduleTraitRebuildForIds } from '@/infrastructure/services/bookmark-trait-service'

/**
 * 同步到 IndexedDB 并广播更新消息
 *
 * @param eventType - 事件类型
 * @param bookmarkId - 书签 ID
 * @param forceFullSync - 是否强制全量同步（默认 false，使用增量同步）
 */
async function syncAndBroadcast(
  eventType: 'created' | 'changed' | 'moved' | 'removed',
  bookmarkId: string,
  forceFullSync = false
): Promise<void> {
  try {
    if (await isBookmarkSyncBatchSuspended()) {
      logger.debug('BackgroundBookmarks', '批量应用进行中，跳过自动同步', {
        eventType,
        bookmarkId
      })
      return
    }

    logger.info('BackgroundBookmarks', `🔄 书签 ${eventType}:`, bookmarkId)

    // 1. 根据情况选择全量或增量同步（无论内部/外部都需要同步数据）
    if (forceFullSync) {
      logger.info('BackgroundBookmarks', '🔄 执行全量同步（移动操作需重建 pathIds）')
      await bookmarkSyncService.syncAllBookmarks()
    } else {
      // ✅ 优先使用增量同步，性能更好
      logger.info('BackgroundBookmarks', '⚡ 执行增量同步（单节点更新）')
      // ✅ 关键修复：等待增量同步完成后再广播
      // enqueueIncremental 返回的 Promise 会在 syncIncremental 完成时 resolve
      await bookmarkSyncService.enqueueIncremental(eventType, bookmarkId)
      logger.info('BackgroundBookmarks', '✅ 增量同步已完成，准备广播')
    }

    // 2. 广播"书签变更"消息
    // ✅ 此时 IndexedDB 已经更新完成，Popup 读取的数据是最新的
    // 注意：前端 chrome-message-bridge.ts 会根据 eventType 判断是否触发弹窗
    // - created/changed/moved/removed → 真正的外部变更 → 触发弹窗
    // - full-sync/incremental → 内部同步任务 → 不触发弹窗
    try {
      chrome.runtime.sendMessage(
        {
          type: 'ottersage-db-synced',
          eventType: eventType,
          bookmarkId: bookmarkId,
          timestamp: Date.now()
        },
        () => {
          // 使用回调函数来捕获错误，避免 Promise rejection
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || ''
            const isNoReceiver =
              errorMsg.includes('Could not establish connection') ||
              errorMsg.includes('Receiving end does not exist') ||
              errorMsg.includes('Extension context invalidated')

            if (!isNoReceiver) {
              logger.warn('BackgroundBookmarks', '广播消息失败（非接收端问题）', {
                error: chrome.runtime.lastError.message,
                eventType
              })
            }
            // 没有接收端是正常的，不需要警告
          } else {
            logger.info('BackgroundBookmarks', `✅ 已广播书签变更: ${eventType}`)
          }
        }
      )
    } catch (error) {
      logger.warn('BackgroundBookmarks', '广播消息异常', { error, eventType })
    }

    // ⚠️ 临时注释：scheduleTraitRebuildForIds 导致 background.js 导入 app-components
    // 特征重建将在前端页面打开时自动执行
    // scheduleTraitRebuildForIds([bookmarkId], `background-${eventType}`)
  } catch (error) {
    logger.error('BackgroundBookmarks', `❌ 同步失败: ${eventType}`, error)
  }
}

/**
 * 注册书签变化监听器
 *
 * 监听 Chrome bookmarks 的所有变化事件：
 * - onCreated: 书签/文件夹创建
 * - onChanged: 书签标题/URL 修改
 * - onMoved: 书签/文件夹移动
 * - onRemoved: 书签/文件夹删除
 * - onImportBegan/onImportEnded: 书签导入
 */
export function registerBookmarkChangeListeners(): void {
  logger.info('BackgroundBookmarks', '🔧 注册书签变化监听器...')

  // 监听书签创建
  chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    logger.info('BackgroundBookmarks', '📝 书签已创建:', bookmark.title || id)

    // ✅ 创建操作使用增量同步
    await syncAndBroadcast('created', id, false)

    // ✅ 新书签触发检索 profile 生成 + re-embed
    // 仅处理 URL 书签（非文件夹），后台批处理会自动过滤
    if (bookmark.url) {
      scheduleRetrievalProfileSync('bookmark-created')
      scheduleBookmarkEmbeddingSync('bookmark-created', 1500)
    }
  })

  // 监听书签修改
  chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    logger.info('BackgroundBookmarks', '✏️ 书签已修改:', changeInfo.title || id)
    // ✅ 修改操作使用增量同步
    await syncAndBroadcast('changed', id, false)
  })

  // 监听书签移动
  chrome.bookmarks.onMoved.addListener(async id => {
    logger.info('BackgroundBookmarks', '📁 书签已移动:', id)
    // ⚠️ 移动操作需要全量同步，因为会影响 pathIds、ancestorIds 等层级字段
    await syncAndBroadcast('moved', id, true)
  })

  // 监听书签删除
  chrome.bookmarks.onRemoved.addListener(async id => {
    logger.info('BackgroundBookmarks', '🗑️ 书签已删除:', id)

    // ✅ 删除操作使用增量同步
    await syncAndBroadcast('removed', id, false)
  })

  // 监听导入开始
  chrome.bookmarks.onImportBegan?.addListener(() => {
    logger.info('BackgroundBookmarks', '📥 书签导入开始...')
  })

  // 监听导入结束
  chrome.bookmarks.onImportEnded?.addListener(async () => {
    logger.info('BackgroundBookmarks', '📥 书签导入结束，开始同步...')
    // ✅ 导入操作涉及大量变更且无具体 ID，必须使用全量同步
    await syncAndBroadcast('created', 'import-batch', true)

    // ✅ 导入的新书签统一触发检索 profile 生成
    scheduleRetrievalProfileSync('bookmark-import')
    scheduleBookmarkEmbeddingSync('bookmark-import', 1500)
  })

  logger.info('BackgroundBookmarks', '✅ 书签变化监听器已注册')
}
