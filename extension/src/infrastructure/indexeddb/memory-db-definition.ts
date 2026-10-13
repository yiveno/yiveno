import {
  KEYWORD_INDEX_META_STORE,
  KEYWORD_POSTING_STORE,
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_INDEX_BY_OWNER,
  MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK,
  MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED,
  MEMORY_ITEM_INDEX_BY_OWNER_UPDATED,
  MEMORY_ITEM_STORE
} from '@/infrastructure/indexeddb/constants'
import type { IndexedDBDefinition } from '@/infrastructure/indexeddb/manager'

/** 创建或升级 memory_items 表与索引；v4 增加倒排 store。 */
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
}

/** IndexedDB schema 定义。 */
export const memoryDatabaseDefinition: IndexedDBDefinition = {
  name: MEMORY_DATABASE_NAME,
  version: MEMORY_DATABASE_VERSION,
  upgrade: upgradeMemoryDatabase
}
