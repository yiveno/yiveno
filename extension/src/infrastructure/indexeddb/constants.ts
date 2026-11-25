/** Yiveno Memory DB 常量。 */
export const MEMORY_DATABASE_NAME = 'YivenoMemoryDB' as const

/**
 * v10：B 层画像事实 `portrait_facts`（本地-only；不上云；不进 Backup）。
 * v9：浏览行为聚合 `behavior_stats`（本地-only；不上云；不进 Backup）。
 * v8：页面预览截图 `memory_page_previews`（本地-only Blob；不进 Backup / 云同步）。
 * v7：命题向量派生表 `memory_note_embeddings`（可重算缓存；不进 Backup；恢复后重建）。
 * v6：死链巡检派生表 `memory_link_status`（可重算；不进 Backup）。
 */
export const MEMORY_DATABASE_VERSION = 10 as const

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

/**
 * 死链巡检状态（独立派生；不进 Backup；不进 `clues`）。
 * keyPath = id（`${ownerId}\0${sourceMemoryItemId}`）。
 */
export const MEMORY_LINK_STATUS_STORE = 'memory_link_status' as const

/**
 * 命题向量缓存（独立派生；可重算；不进 Backup）。
 * keyPath = id（与 `memory_notes.id` 同形）。
 */
export const MEMORY_NOTE_EMBEDDING_STORE = 'memory_note_embeddings' as const

/**
 * 页面预览截图（独立；本地-only Blob；不进 Backup / 云同步）。
 * keyPath = id（`${ownerId}\0${urlKey}`）。
 */
export const MEMORY_PAGE_PREVIEW_STORE = 'memory_page_previews' as const

/**
 * 浏览行为聚合（独立；本地-only；不上云；不进 Backup）。
 * keyPath = [ownerId, url]（url 已去 fragment）。
 */
export const BEHAVIOR_STATS_STORE = 'behavior_stats' as const

/**
 * B 层画像事实（独立；本地-only；不上云；不进 Backup）。
 * keyPath = id（`${ownerId}\\0${slot}\\0${value}`）；永不因 decline 删行。
 */
export const PORTRAIT_FACTS_STORE = 'portrait_facts' as const

/** ownerId，按归属枚举画像事实。 */
export const PORTRAIT_FACTS_INDEX_BY_OWNER = 'by_owner' as const

/** ownerId + domain，按域名枚举。 */
export const BEHAVIOR_STATS_INDEX_BY_OWNER_DOMAIN = 'by_owner_domain' as const

/** ownerId + lastVisitTime，按最近访问排序。 */
export const BEHAVIOR_STATS_INDEX_BY_OWNER_LAST_VISIT = 'by_owner_last_visit' as const

/** ownerId + visitCount，按访问次数排序。 */
export const BEHAVIOR_STATS_INDEX_BY_OWNER_VISIT_COUNT = 'by_owner_visit_count' as const

/** ownerId + lastCheckedAt，未检查优先排队。 */
export const MEMORY_LINK_STATUS_INDEX_BY_OWNER_CHECKED = 'by_owner_checked' as const

/** ownerId，按归属枚举命题向量（回填 / 清库）。 */
export const MEMORY_NOTE_EMBEDDING_INDEX_BY_OWNER = 'by_owner' as const

/** ownerId，按归属枚举预览截图（清库 / LRU 扫描）。 */
export const MEMORY_PAGE_PREVIEW_INDEX_BY_OWNER = 'by_owner' as const

/** ownerId + lastShownAt，LRU 淘汰最久未展示。 */
export const MEMORY_PAGE_PREVIEW_INDEX_BY_OWNER_SHOWN = 'by_owner_shown' as const

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
