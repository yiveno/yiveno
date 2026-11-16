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
  MEMORY_NOTES_STORE
} from '@/infrastructure/indexeddb/constants'
import type { IndexedDBDefinition } from '@/infrastructure/indexeddb/manager'

/** 创建或升级 memory_items 表与索引；v4 倒排；v5 dreaming；v6 死链；v7 命题向量。 */
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
}

/** IndexedDB schema 定义。 */
export const memoryDatabaseDefinition: IndexedDBDefinition = {
  name: MEMORY_DATABASE_NAME,
  version: MEMORY_DATABASE_VERSION,
  upgrade: upgradeMemoryDatabase
}
