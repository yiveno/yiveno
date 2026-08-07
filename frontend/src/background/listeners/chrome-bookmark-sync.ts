import {
  handleChromeBookmarkChanged,
  handleChromeBookmarkCreated,
  handleChromeBookmarkRemoved,
  isChromeBookmarkIngestEnabled
} from '@/application/capture/chrome-bookmark-sync-service'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { logger } from '@/infrastructure/logging/logger'
import { notifyChromeBookmarkTreeChanged } from '@/infrastructure/messaging/notify-chrome-bookmark-tree-changed'

let listenersRegistered = false

function onBookmarkCreated(id: string, bookmark: chrome.bookmarks.BookmarkTreeNode): void {
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
    .finally(() => {
      // 目录改名等不进 Memory，仍须刷新记忆库只读树（仅灌库开启时本监听才挂着）
      notifyChromeBookmarkTreeChanged()
    })
}

function onBookmarkChanged(id: string, changeInfo: { title?: string; url?: string }): void {
  void handleChromeBookmarkChanged(id)
    .catch(error => {
      logger.error('ChromeBookmarkSync', 'onChanged 同步失败', { id, changeInfo, error })
    })
    .finally(() => {
      notifyChromeBookmarkTreeChanged()
    })
}

function onBookmarkRemoved(
  id: string,
  removeInfo: { parentId: string; index: number; node: chrome.bookmarks.BookmarkTreeNode }
): void {
  void handleChromeBookmarkRemoved(id)
    .catch(error => {
      logger.error('ChromeBookmarkSync', 'onRemoved 同步失败', { id, removeInfo, error })
    })
    .finally(() => {
      notifyChromeBookmarkTreeChanged()
    })
}

function onBookmarkMoved(
  id: string,
  moveInfo: { parentId: string; index: number; oldParentId: string; oldIndex: number }
): void {
  void handleChromeBookmarkChanged(id)
    .catch(error => {
      logger.error('ChromeBookmarkSync', 'onMoved 同步失败', { id, moveInfo, error })
    })
    .finally(() => {
      notifyChromeBookmarkTreeChanged()
    })
}

/**
 * 注册 Chrome 书签增量同步监听器。
 * 灌库关闭时应调用 {@link unregisterChromeBookmarkSyncListeners}，不得常驻监听。
 */
export function registerChromeBookmarkSyncListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  chrome.bookmarks.onCreated.addListener(onBookmarkCreated)
  chrome.bookmarks.onChanged.addListener(onBookmarkChanged)
  chrome.bookmarks.onRemoved.addListener(onBookmarkRemoved)
  chrome.bookmarks.onMoved.addListener(onBookmarkMoved)

  logger.info('ChromeBookmarkSync', '书签增量监听器已注册')
}

/**
 * 卸载书签增量监听：关闭「将 Chrome 书签写入记忆」后调用。
 * 卸载后不再处理新增/变更，也不再推送记忆库热更新。
 */
export function unregisterChromeBookmarkSyncListeners(): void {
  if (!listenersRegistered) {
    return
  }

  chrome.bookmarks.onCreated.removeListener(onBookmarkCreated)
  chrome.bookmarks.onChanged.removeListener(onBookmarkChanged)
  chrome.bookmarks.onRemoved.removeListener(onBookmarkRemoved)
  chrome.bookmarks.onMoved.removeListener(onBookmarkMoved)
  listenersRegistered = false

  logger.info('ChromeBookmarkSync', '书签增量监听器已卸载（灌库关闭）')
}

/** 当前是否已挂上书签增量监听（测试 / 诊断用）。 */
export function areChromeBookmarkSyncListenersRegistered(): boolean {
  return listenersRegistered
}

/**
 * 按灌库开关挂/卸监听。
 * @param enabled 显式传入时跳过读 Settings（Settings 更新路径用）。
 */
export async function syncChromeBookmarkSyncListenersWithIngestSetting(
  enabled?: boolean
): Promise<void> {
  const ingestEnabled = enabled ?? (await isChromeBookmarkIngestEnabled())
  if (ingestEnabled) {
    registerChromeBookmarkSyncListeners()
    return
  }
  unregisterChromeBookmarkSyncListeners()
}

/** 测试用：重置监听器注册状态（不调用 Chrome remove，需配合 mock）。 */
export function resetChromeBookmarkSyncListenersForTests(): void {
  listenersRegistered = false
}
