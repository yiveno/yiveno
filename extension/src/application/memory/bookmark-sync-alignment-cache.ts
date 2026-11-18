import type { BookmarkSyncAlignment } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  getCachedBookmarkSyncAlignment,
  invalidateBookmarkSyncAlignmentCache,
  setCachedBookmarkSyncAlignment
} from '@/application/memory/bookmark-sync-alignment-cache-state'

/** 既有调用点继续从本模块 import 失效；实现下沉到叶模块。 */
export { invalidateBookmarkSyncAlignmentCache }

/** 读取书签对齐表（带内存缓存）。 */
export async function getBookmarkSyncAlignmentCached(): Promise<BookmarkSyncAlignment> {
  const hit = getCachedBookmarkSyncAlignment()
  if (hit) {
    return hit as BookmarkSyncAlignment
  }
  const alignment = await memoryItemService.listBookmarkSyncAlignment()
  setCachedBookmarkSyncAlignment(alignment)
  return alignment
}
