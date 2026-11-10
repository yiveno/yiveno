/** Yiveno Memory DB 常量。 */
export const MEMORY_DATABASE_NAME = 'YivenoMemoryDB' as const

/** v5：dreaming 派生表 `memory_notes` + `memory_notes_meta`（ADR-022）。 */
export const MEMORY_DATABASE_VERSION = 5 as const

export const MEMORY_ITEM_STORE = 'memory_items' as const

/** 关键词倒排：owner+token → itemId 列表。 */
export const KEYWORD_POSTING_STORE = 'keyword_postings' as const

/** 每 owner 一条：是否 dirty / 上次重建。 */
export const KEYWORD_INDEX_META_STORE = 'keyword_index_meta' as const

/**
 * Dreaming 原子命题派生表（L3；不进云同步面；Backup 须含）。
 * 只写派生，永不改 `memory_items` 行。
 */
export const MEMORY_NOTES_STORE = 'memory_notes' as const

/** 每 owner 一条：dreaming run 游标 / dirty / schema。 */
export const MEMORY_NOTES_META_STORE = 'memory_notes_meta' as const

/**
 * Capture 去重键 → 多源链接（只标不删；同一 foldKey 一组）。
 */
export const DREAMING_DUPLICATE_GROUP_STORE = 'dreaming_duplicate_groups' as const

/** ownerId + sourceMemoryItemId，按源查命题。 */
export const MEMORY_NOTES_INDEX_BY_OWNER_SOURCE = 'by_owner_source' as const

/** ownerId + updatedAt，增量扫命题。 */
export const MEMORY_NOTES_INDEX_BY_OWNER_UPDATED = 'by_owner_updated' as const

/** 倒排 meta.schemaVersion；与 posting 格式联动，升则强制 rebuild。 */
export const KEYWORD_INDEX_SCHEMA_VERSION = 2 as const

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

/** posting 查询并集后的候选 id 上限（再 getById）；截断时按 token 稀有度优先，见 selectPostingCandidateIds。 */
export const KEYWORD_INDEX_CANDIDATE_ID_CAP = 2000 as const

/**
 * putMany 走批内增量的最大条数；更大则标 dirty 等 Recall rebuild，避免超长事务。
 */
export const KEYWORD_INDEX_PUT_MANY_INCREMENTAL_MAX = 500 as const
