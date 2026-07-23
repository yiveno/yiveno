/** Yiveno Memory DB 常量。 */
export const MEMORY_DATABASE_NAME = 'YivenoMemoryDB' as const

/** v2：增加 ownerId + chromeBookmarkId 索引，支持书签导入去重。 */
export const MEMORY_DATABASE_VERSION = 2 as const

export const MEMORY_ITEM_STORE = 'memory_items' as const

/** ownerId + updatedAt，按时间倒序列出。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_UPDATED = 'by_owner_updated' as const

/** ownerId + type + updatedAt，按类型筛选并排序。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED = 'by_owner_type_updated' as const

/** ownerId + Chrome 书签 ID，导入时 upsert。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK = 'by_owner_chrome_bookmark' as const

/** 每批 bulk 写入条数（单事务 putMany）。 */
export const MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE = 2000 as const
