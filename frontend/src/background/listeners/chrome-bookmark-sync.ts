import {
  handleChromeBookmarkChanged,
  handleChromeBookmarkCreated,
  handleChromeBookmarkRemoved
} from '@/application/capture/chrome-bookmark-sync-service'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { logger } from '@/infrastructure/logging/logger'

let listenersRegistered = false

/** 注册 Chrome 书签增量同步监听器（仅 Background 调用一次）。 */
export function registerChromeBookmarkSyncListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    void handleChromeBookmarkCreated(bookmark)
      .then(result => {
        if (result.captured) {
          void flashActionBadge('success')
        }
      })
      .catch(error => {
        logger.error('ChromeBookmarkSync', 'onCreated 同步失败', { id, error })
        void flashActionBadge('error')
      })
  })

  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    void handleChromeBookmarkChanged(id).catch(error => {
      logger.error('ChromeBookmarkSync', 'onChanged 同步失败', { id, changeInfo, error })
    })
  })

  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    void handleChromeBookmarkRemoved(id).catch(error => {
      logger.error('ChromeBookmarkSync', 'onRemoved 同步失败', { id, removeInfo, error })
    })
  })

  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    void handleChromeBookmarkChanged(id).catch(error => {
      logger.error('ChromeBookmarkSync', 'onMoved 同步失败', { id, moveInfo, error })
    })
  })

  logger.info('ChromeBookmarkSync', '书签增量监听器已注册')
}

/** 测试用：重置监听器注册状态。 */
export function resetChromeBookmarkSyncListenersForTests(): void {
  listenersRegistered = false
}
