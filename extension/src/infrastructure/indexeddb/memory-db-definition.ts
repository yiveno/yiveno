import {
  KEYWORD_INDEX_META_STORE,
  KEYWORD_POSTING_STORE,
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_INDEX_BY_OWNER,
  MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK,
  MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED,
  MEMORY_ITEM_INDEX_BY_OWNER_UPDATED,
  MEMORY_ITEM_STORE,
  DREAMING_DUPLICATE_GROUP_STORE,
  MEMORY_LINK_STATUS_INDEX_BY_OWNER_CHECKED,
  MEMORY_LINK_STATUS_STORE,
  MEMORY_NOTE_EMBEDDING_INDEX_BY_OWNER,
  MEMORY_NOTE_EMBEDDING_STORE,
  MEMORY_NOTES_INDEX_BY_OWNER_SOURCE,
  MEMORY_NOTES_INDEX_BY_OWNER_UPDATED,
  MEMORY_NOTES_META_STORE,
  MEMORY_NOTES_STORE,
  MEMORY_PAGE_PREVIEW_INDEX_BY_OWNER,
  MEMORY_PAGE_PREVIEW_INDEX_BY_OWNER_SHOWN,
  MEMORY_PAGE_PREVIEW_STORE,
  BEHAVIOR_STATS_STORE,
  BEHAVIOR_STATS_INDEX_BY_OWNER_DOMAIN,
  BEHAVIOR_STATS_INDEX_BY_OWNER_LAST_VISIT,
  BEHAVIOR_STATS_INDEX_BY_OWNER_VISIT_COUNT
} from '@/infrastructure/indexeddb/constants'
import type { IndexedDBDefinition } from '@/infrastructure/indexeddb/manager'

/** 创建或升级 memory_items 表与索引；v4 倒排；v5 dreaming；v6 死链；v7 命题向量；v8 页预览；v9 行为统计。 */
function upgradeMemoryDatabase(
  database: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number
): void {
  let store: IDBObjectStore

  if (oldVersion < 1) {
    store = database.createObjectStore(MEMORY_ITEM_STORE, { keyPath: 'id' })
    store.createIndex(MEMORY_ITEM_INDEX_BY_OWNER_UPDATED, ['ownerId', 'updatedAt'], {
      unique: false
    })
    store.createIndex(MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED, ['ownerId', 'type', 'updatedAt'], {
      unique: false
    })
  } else {
    store = transaction.objectStore(MEMORY_ITEM_STORE)
  }

  if (oldVersion < 2 && !store.indexNames.contains(MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK)) {
    store.createIndex(
      MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK,
      ['ownerId', 'payload.chromeBookmarkId'],
      { unique: false }
    )
  }

  if (oldVersion < 3 && !store.indexNames.contains(MEMORY_ITEM_INDEX_BY_OWNER)) {
    store.createIndex(MEMORY_ITEM_INDEX_BY_OWNER, 'ownerId', { unique: false })
  }

  if (oldVersion < 4) {
    if (!database.objectStoreNames.contains(KEYWORD_POSTING_STORE)) {
      database.createObjectStore(KEYWORD_POSTING_STORE, { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains(KEYWORD_INDEX_META_STORE)) {
      database.createObjectStore(KEYWORD_INDEX_META_STORE, { keyPath: 'ownerId' })
    }
  }

  // v5：只建 store/索引，不做记录回填 / 全库扫描（ADR-022）。
  if (oldVersion < 5) {
    if (!database.objectStoreNames.contains(MEMORY_NOTES_STORE)) {
      const notesStore = database.createObjectStore(MEMORY_NOTES_STORE, { keyPath: 'id' })
      notesStore.createIndex(
        MEMORY_NOTES_INDEX_BY_OWNER_SOURCE,
        ['ownerId', 'sourceMemoryItemId'],
        {
          unique: false
        }
      )
      notesStore.createIndex(MEMORY_NOTES_INDEX_BY_OWNER_UPDATED, ['ownerId', 'updatedAt'], {
        unique: false
      })
    }
    if (!database.objectStoreNames.contains(MEMORY_NOTES_META_STORE)) {
      database.createObjectStore(MEMORY_NOTES_META_STORE, { keyPath: 'ownerId' })
    }
    if (!database.objectStoreNames.contains(DREAMING_DUPLICATE_GROUP_STORE)) {
      database.createObjectStore(DREAMING_DUPLICATE_GROUP_STORE, { keyPath: 'id' })
    }
  }

  // v6：只建 store/索引，不做记录回填（死链状态可重算）。
  if (oldVersion < 6) {
    if (!database.objectStoreNames.contains(MEMORY_LINK_STATUS_STORE)) {
      const linkStore = database.createObjectStore(MEMORY_LINK_STATUS_STORE, { keyPath: 'id' })
      linkStore.createIndex(
        MEMORY_LINK_STATUS_INDEX_BY_OWNER_CHECKED,
        ['ownerId', 'lastCheckedAt'],
        {
          unique: false
        }
      )
    }
  }

  // v7：命题向量独立 store（可重算；不进 Backup；build-only + contains guard）。
  if (oldVersion < 7) {
    if (!database.objectStoreNames.contains(MEMORY_NOTE_EMBEDDING_STORE)) {
      const embedStore = database.createObjectStore(MEMORY_NOTE_EMBEDDING_STORE, {
        keyPath: 'id'
      })
      embedStore.createIndex(MEMORY_NOTE_EMBEDDING_INDEX_BY_OWNER, 'ownerId', { unique: false })
    }
  }

  // v8：页面预览截图（本地-only Blob；不进 Backup；build-only + contains guard）。
  if (oldVersion < 8) {
    if (!database.objectStoreNames.contains(MEMORY_PAGE_PREVIEW_STORE)) {
      const previewStore = database.createObjectStore(MEMORY_PAGE_PREVIEW_STORE, {
        keyPath: 'id'
      })
      previewStore.createIndex(MEMORY_PAGE_PREVIEW_INDEX_BY_OWNER, 'ownerId', { unique: false })
      previewStore.createIndex(
        MEMORY_PAGE_PREVIEW_INDEX_BY_OWNER_SHOWN,
        ['ownerId', 'lastShownAt'],
        { unique: false }
      )
    }
  }

  // v9：浏览行为聚合（本地-only；不上云；build-only + contains guard）。
  if (oldVersion < 9) {
    if (!database.objectStoreNames.contains(BEHAVIOR_STATS_STORE)) {
      const behaviorStore = database.createObjectStore(BEHAVIOR_STATS_STORE, {
        keyPath: ['ownerId', 'url']
      })
      behaviorStore.createIndex(BEHAVIOR_STATS_INDEX_BY_OWNER_DOMAIN, ['ownerId', 'domain'], {
        unique: false
      })
      behaviorStore.createIndex(
        BEHAVIOR_STATS_INDEX_BY_OWNER_LAST_VISIT,
        ['ownerId', 'lastVisitTime'],
        { unique: false }
      )
      behaviorStore.createIndex(
        BEHAVIOR_STATS_INDEX_BY_OWNER_VISIT_COUNT,
        ['ownerId', 'visitCount'],
        { unique: false }
      )
    }
  }
}

/** IndexedDB schema 定义。 */
export const memoryDatabaseDefinition: IndexedDBDefinition = {
  name: MEMORY_DATABASE_NAME,
  version: MEMORY_DATABASE_VERSION,
  upgrade: upgradeMemoryDatabase
}
