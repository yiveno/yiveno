import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem,
  type CreateBookmarkInput,
  type CreateTextExcerptInput
} from '@/core/memory/create-memory-item'
import { MemoryItemSchema, safeParseMemoryItem, type MemoryItem } from '@/core/memory/memory-item'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import {
  MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK,
  MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED,
  MEMORY_ITEM_INDEX_BY_OWNER_UPDATED,
  MEMORY_ITEM_STORE
} from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'

export interface ListMemoryItemsOptions {
  type?: SupportedMemoryItemType
  limit?: number
  includeDeleted?: boolean
}

export class MemoryItemRepository {
  /** 确保数据库已初始化。 */
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  /** 写入 Bookmark MemoryItem。 */
  async createBookmark(input: CreateBookmarkInput): Promise<MemoryItem> {
    const item = await this.buildBookmarkItem(input)
    await this.put(item)
    return item
  }

  /** 写入 Text Excerpt MemoryItem。 */
  async createTextExcerpt(input: CreateTextExcerptInput): Promise<MemoryItem> {
    const item = await this.buildTextExcerptItem(input)
    await this.put(item)
    return item
  }

  /** 按 ID 读取；ownerId 不匹配时返回 null。 */
  async getById(id: string, ownerId?: string): Promise<MemoryItem | null> {
    await this.ensureReady()
    const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const raw = await requestToPromise(store.get(id))
      const item = safeParseMemoryItem(raw)
      if (!item || item.ownerId !== resolvedOwnerId) {
        return null
      }
      return item
    })
  }

  /** 按 Chrome 书签 ID 查找当前用户的 Bookmark MemoryItem。 */
  async getByChromeBookmarkId(
    chromeBookmarkId: string,
    ownerId?: string
  ): Promise<MemoryItem | null> {
    await this.ensureReady()
    const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const index = transaction
        .objectStore(MEMORY_ITEM_STORE)
        .index(MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK)
      const raw = await requestToPromise(index.get([resolvedOwnerId, chromeBookmarkId]))
      const item = safeParseMemoryItem(raw)
      if (!item || item.ownerId !== resolvedOwnerId || item.deletedAt != null) {
        return null
      }
      return item
    })
  }

  /**
   * 从 Chrome 书签 upsert Bookmark MemoryItem。
   * 已存在则更新标题/URL；不存在则新建。
   */
  async upsertBookmarkFromChrome(input: CreateBookmarkInput): Promise<MemoryItem> {
    const chromeBookmarkId = input.payload.chromeBookmarkId
    if (!chromeBookmarkId) {
      return this.createBookmark(input)
    }

    const existing = await this.getByChromeBookmarkId(chromeBookmarkId)
    if (!existing || existing.type !== 'bookmark') {
      return this.createBookmark({
        ...input,
        captureEntry: input.captureEntry ?? 'sync'
      })
    }

    const [ownerId, profile] = await Promise.all([getCurrentOwnerId(), getOrCreateLocalProfile()])
    const next = createBookmarkMemoryItem({
      ...input,
      ownerId,
      sourceLocalProfileId: profile.localProfileId,
      captureEntry: input.captureEntry ?? existing.clues.captureEntry ?? 'sync',
      now: () => new Date().toISOString()
    })

    const merged: MemoryItem = {
      ...next,
      id: existing.id,
      createdAt: existing.createdAt,
      clues: {
        ...next.clues,
        openCount: existing.clues.openCount,
        lastOpenedAt: existing.clues.lastOpenedAt,
        tags: existing.clues.tags.length > 0 ? existing.clues.tags : next.clues.tags,
        note: existing.clues.note ?? next.clues.note
      }
    }

    await this.put(merged)
    return merged
  }

  /** 批量写入 MemoryItem（同一事务）。 */
  async putMany(items: MemoryItem[]): Promise<void> {
    if (items.length === 0) {
      return
    }

    await this.ensureReady()
    await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      for (const item of items) {
        await requestToPromise(store.put(MemoryItemSchema.parse(item)))
      }
    })
  }

  /** 列出当前用户的 MemoryItem，默认按 updatedAt 倒序。 */
  async listByOwner(options: ListMemoryItemsOptions = {}): Promise<MemoryItem[]> {
    await this.ensureReady()
    const ownerId = await getCurrentOwnerId()
    const limit = options.limit ?? 100
    const includeDeleted = options.includeDeleted ?? false

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const indexName = options.type
        ? MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED
        : MEMORY_ITEM_INDEX_BY_OWNER_UPDATED
      const index = store.index(indexName)

      const lower = options.type ? [ownerId, options.type, ''] : [ownerId, '']
      const upper = options.type ? [ownerId, options.type, '\uffff'] : [ownerId, '\uffff']
      const range = IDBKeyRange.bound(lower, upper)

      const items: MemoryItem[] = []
      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range, 'prev')

        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve()
            return
          }

          const item = safeParseMemoryItem(cursor.value)
          if (item && (includeDeleted || item.deletedAt == null)) {
            items.push(item)
          }

          if (items.length >= limit) {
            resolve()
            return
          }

          cursor.continue()
        }

        request.onerror = () => reject(request.error ?? new Error('IndexedDB 游标读取失败'))
      })

      return items
    })
  }

  /** 软删除 MemoryItem。 */
  async softDelete(id: string): Promise<MemoryItem | null> {
    const ownerId = await getCurrentOwnerId()
    const existing = await this.getById(id, ownerId)
    if (!existing) {
      return null
    }

    const deleted: MemoryItem = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await this.put(deleted)
    return deleted
  }

  /** 按 Chrome 书签 ID 软删除 Bookmark MemoryItem。 */
  async softDeleteByChromeBookmarkId(chromeBookmarkId: string): Promise<MemoryItem | null> {
    const existing = await this.getByChromeBookmarkId(chromeBookmarkId)
    if (!existing) {
      return null
    }
    return this.softDelete(existing.id)
  }

  /** 统计当前用户未删除的 MemoryItem 数量。 */
  async countActiveByOwner(type?: SupportedMemoryItemType): Promise<number> {
    const items = await this.listByOwner({ type, limit: Number.MAX_SAFE_INTEGER })
    return items.length
  }

  private async buildBookmarkItem(input: CreateBookmarkInput): Promise<MemoryItem> {
    const [ownerId, profile] = await Promise.all([getCurrentOwnerId(), getOrCreateLocalProfile()])
    return createBookmarkMemoryItem({
      ...input,
      ownerId,
      sourceLocalProfileId: profile.localProfileId
    })
  }

  private async buildTextExcerptItem(input: CreateTextExcerptInput): Promise<MemoryItem> {
    const [ownerId, profile] = await Promise.all([getCurrentOwnerId(), getOrCreateLocalProfile()])
    return createTextExcerptMemoryItem({
      ...input,
      ownerId,
      sourceLocalProfileId: profile.localProfileId
    })
  }

  private async put(item: MemoryItem): Promise<void> {
    await this.ensureReady()
    const validated = MemoryItemSchema.parse(item)

    await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      await requestToPromise(store.put(validated))
    })
  }
}

export const memoryItemRepository = new MemoryItemRepository()
