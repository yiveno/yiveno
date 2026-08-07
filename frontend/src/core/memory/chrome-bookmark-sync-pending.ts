import { z } from 'zod'

/** chrome.storage.session 中积压增量事件的键（SW 重启可恢复）。 */
export const CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY = 'yiveno:chrome_bookmark_sync_pending'

/**
 * 导入未完成期间积压的 Chrome 书签增量 id。
 * 存 session：同浏览器会话内 SW 被杀后仍可 flush；关浏览器后清空亦可由 reconcile 补洞。
 */
export const ChromeBookmarkSyncPendingSchema = z.object({
  upsertIds: z.array(z.string().min(1)), // 待 upsert 的 chromeBookmarkId
  removeIds: z.array(z.string().min(1)) // 待软删的 chromeBookmarkId
})

export type ChromeBookmarkSyncPending = z.infer<typeof ChromeBookmarkSyncPendingSchema>
