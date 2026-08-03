/** Yiveno Memory DB 常量。 */
export const MEMORY_DATABASE_NAME = 'YivenoMemoryDB' as const

/** v3：增加单字段 ownerId 索引，便于按归属全量扫描 / remap。 */
export const MEMORY_DATABASE_VERSION = 3 as const

export const MEMORY_ITEM_STORE = 'memory_items' as const

/** 仅 ownerId，按归属枚举（登录后 remap / 同步计数）。 */
export const MEMORY_ITEM_INDEX_BY_OWNER = 'by_owner' as const

/** ownerId + updatedAt，按时间倒序列出。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_UPDATED = 'by_owner_updated' as const

/** ownerId + type + updatedAt，按类型筛选并排序。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED = 'by_owner_type_updated' as const

/** ownerId + Chrome 书签 ID，导入时 upsert。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK = 'by_owner_chrome_bookmark' as const

/** 每批 bulk 写入条数（单事务 putMany）。 */
export const MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE = 2000 as const
