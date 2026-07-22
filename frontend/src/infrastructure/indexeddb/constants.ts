/** Yiveno Memory DB 常量。 */
export const MEMORY_DATABASE_NAME = 'YivenoMemoryDB' as const

export const MEMORY_DATABASE_VERSION = 1 as const

export const MEMORY_ITEM_STORE = 'memory_items' as const

/** ownerId + updatedAt，按时间倒序列出。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_UPDATED = 'by_owner_updated' as const

/** ownerId + type + updatedAt，按类型筛选并排序。 */
export const MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED = 'by_owner_type_updated' as const
