import {
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED,
  MEMORY_ITEM_INDEX_BY_OWNER_UPDATED,
  MEMORY_ITEM_STORE
} from '@/infrastructure/indexeddb/constants'
import type { IndexedDBDefinition } from '@/infrastructure/indexeddb/manager'

/** 创建 memory_items 表与索引。 */
function upgradeMemoryDatabase(
  database: IDBDatabase,
  _transaction: IDBTransaction,
  oldVersion: number
): void {
  if (oldVersion >= MEMORY_DATABASE_VERSION) {
    return
  }

  const store = database.createObjectStore(MEMORY_ITEM_STORE, { keyPath: 'id' })

  store.createIndex(MEMORY_ITEM_INDEX_BY_OWNER_UPDATED, ['ownerId', 'updatedAt'], {
    unique: false
  })
  store.createIndex(MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED, ['ownerId', 'type', 'updatedAt'], {
    unique: false
  })
}

/** IndexedDB schema 定义。 */
export const memoryDatabaseDefinition: IndexedDBDefinition = {
  name: MEMORY_DATABASE_NAME,
  version: MEMORY_DATABASE_VERSION,
  upgrade: upgradeMemoryDatabase
}
