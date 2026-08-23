import type { BookmarkSyncAlignment } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryItemService } from '@/application/memory/memory-item-service'

/** SW 侧 alignment 缓存：避免每次 GET_BOOKMARK_LIBRARY_TREE 全扫 IDB。 */
let cachedAlignment: BookmarkSyncAlignment | null = null

/** 读取书签对齐表（带内存缓存）。 */
export async function getBookmarkSyncAlignmentCached(): Promise<BookmarkSyncAlignment> {
  if (cachedAlignment) {
    return cachedAlignment
  }
  cachedAlignment = await memoryItemService.listBookmarkSyncAlignment()
  return cachedAlignment
}

/** 书签 Memory 变更后失效缓存（导入、补注、同步 upsert 等）。 */
export function invalidateBookmarkSyncAlignmentCache(): void {
  cachedAlignment = null
}
