/**
 * 批量应用提案期间，暂停 Chrome 书签事件触发的自动同步。
 *
 * 应用结束后由调用方显式触发一次全量 sync，避免大量 move 引发同步风暴。
 */

import { chromeStorage } from '@/infrastructure/storage/chrome-storage'

/** session storage key（与 background/bookmarks.ts 共用） */
export const BOOKMARK_SYNC_BATCH_SESSION_KEY = 'bookmark_sync_batch_apply'

export async function setBookmarkSyncBatchSuspended(suspended: boolean): Promise<void> {
  await chromeStorage.setSession(BOOKMARK_SYNC_BATCH_SESSION_KEY, suspended)
}

export async function isBookmarkSyncBatchSuspended(): Promise<boolean> {
  return (await chromeStorage.getSession<boolean>(BOOKMARK_SYNC_BATCH_SESSION_KEY, false)) ?? false
}
