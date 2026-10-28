import {
  handleChromeBookmarkChanged,
  handleChromeBookmarkCreated,
  handleChromeBookmarkRemoved,
  isChromeBookmarkIngestEnabled
} from '@/application/capture/chrome-bookmark-sync-service'
import { ensureChromeBookmarkRepairAlarm } from '@/infrastructure/sync/chrome-bookmark-repair-alarm'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { logger } from '@/infrastructure/logging/logger'
import { invalidateBookmarkLibraryTreeOnChromeChange } from '@/background/handlers/import-handler'
import { notifyChromeBookmarkTreeChanged } from '@/infrastructure/messaging/notify-chrome-bookmark-tree-changed'

let listenersRegistered = false

/**
 * 书签同步写 Memory 前须等 bootstrap。
 * 扩展 SW 禁止动态 import()；经 bootstrap-ready 静态门闩，避免与 bootstrap 实现环。
 */
async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

/** Chrome 书签树结构/对齐可能变化：失效 SW 缓存并通知记忆库 UI。 */
function notifyBookmarkLibraryTreeRefresh(): void {
  invalidateBookmarkLibraryTreeOnChromeChange()
  notifyChromeBookmarkTreeChanged()
}

function onBookmarkCreated(id: string, bookmark: chrome.bookmarks.BookmarkTreeNode): void {
  void ensureBootstrapReady()
    .then(() => handleChromeBookmarkCreated(bookmark))
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
      notifyBookmarkLibraryTreeRefresh()
    })
}

function onBookmarkChanged(id: string, changeInfo: { title?: string; url?: string }): void {
  void ensureBootstrapReady()
    .then(() => handleChromeBookmarkChanged(id))
    .catch(error => {
      logger.error('ChromeBookmarkSync', 'onChanged 同步失败', { id, changeInfo, error })
    })
    .finally(() => {
      notifyBookmarkLibraryTreeRefresh()
    })
}

function onBookmarkRemoved(
  id: string,
  removeInfo: { parentId: string; index: number; node: chrome.bookmarks.BookmarkTreeNode }
): void {
  void ensureBootstrapReady()
    .then(() => handleChromeBookmarkRemoved(id))
    .catch(error => {
      logger.error('ChromeBookmarkSync', 'onRemoved 同步失败', { id, removeInfo, error })
    })
    .finally(() => {
      notifyBookmarkLibraryTreeRefresh()
    })
}

function onBookmarkMoved(
  id: string,
  moveInfo: { parentId: string; index: number; oldParentId: string; oldIndex: number }
): void {
  void ensureBootstrapReady()
    .then(() => handleChromeBookmarkChanged(id))
    .catch(error => {
      logger.error('ChromeBookmarkSync', 'onMoved 同步失败', { id, moveInfo, error })
    })
    .finally(() => {
      notifyBookmarkLibraryTreeRefresh()
    })
}

/**
 * SW 入口同步挂上书签监听，消除异步读 Settings 前的空窗。
 * 灌库关闭时由 {@link syncChromeBookmarkSyncListenersWithIngestSetting} 再卸下；
 * 写入路径仍经 {@link handleChromeBookmarkCreated} 内门禁。
 */
export function attachChromeBookmarkSyncListenersAtStartup(): void {
  registerChromeBookmarkSyncListeners()
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
    await ensureChromeBookmarkRepairAlarm(true)
    return
  }
  unregisterChromeBookmarkSyncListeners()
  await ensureChromeBookmarkRepairAlarm(false)
}

/** 测试用：重置监听器注册状态（不调用 Chrome remove，需配合 mock）。 */
export function resetChromeBookmarkSyncListenersForTests(): void {
  listenersRegistered = false
}
