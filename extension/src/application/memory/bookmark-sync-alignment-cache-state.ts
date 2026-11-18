/**
 * 书签对齐缓存的零依赖叶状态（避免 schedule-async-memory-embedding ↔ alignment-cache 成环）。
 * 有业务语义的 get 仍在 `bookmark-sync-alignment-cache.ts`；本文件只持有变量与失效。
 * 刻意零 import：类型由调用方约束，避免再拉 repository / service。
 */

let cachedAlignment: unknown = null

/** 读取当前内存缓存（供 get 路径命中）。 */
export function getCachedBookmarkSyncAlignment(): unknown {
  return cachedAlignment
}

/** 写入内存缓存（供 get 路径重建后落库）。 */
export function setCachedBookmarkSyncAlignment(alignment: unknown): void {
  cachedAlignment = alignment
}

/** 书签 Memory 变更后失效缓存（导入、补注、同步 upsert、配额驱逐等）。 */
export function invalidateBookmarkSyncAlignmentCache(): void {
  cachedAlignment = null
}
