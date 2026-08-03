import { optionalProp } from '@/core/common/optional-props'
import { normalizeBookmarkSyncUrl } from '@/core/memory/bookmark-library-tree'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem,
  type CreateBookmarkInput,
  type CreateTextExcerptInput
} from '@/core/memory/create-memory-item'
import { mergeUniqueStrings } from '@/core/memory/enrich-memory-clues'
import { MemoryItemSchema, safeParseMemoryItem, type MemoryItem } from '@/core/memory/memory-item'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import {
  MEMORY_ITEM_INDEX_BY_OWNER,
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

/** 书签树对齐：Chrome 书签 id / URL → MemoryItem.id */
export interface BookmarkSyncAlignment {
  byChromeBookmarkId: Map<string, string>
  byUrl: Map<string, string>
  /** MemoryItem.id → 非空备注 */
  noteByMemoryId: Map<string, string>
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

  /** 按 ID 读取；ownerId 不匹配或已软删时返回 null（除非 includeDeleted）。 */
  async getById(
    id: string,
    ownerId?: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<MemoryItem | null> {
    await this.ensureReady()
    const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const raw = await requestToPromise(store.get(id))
      const item = safeParseMemoryItem(raw)
      if (!item || item.ownerId !== resolvedOwnerId) {
        return null
      }
      if (!options.includeDeleted && item.deletedAt != null) {
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
        dismissCount: existing.clues.dismissCount,
        lastDismissedAt: existing.clues.lastDismissedAt,
        tags: mergeUniqueStrings(existing.clues.tags, next.clues.tags),
        keywords: mergeUniqueStrings(existing.clues.keywords, next.clues.keywords),
        entities: mergeUniqueStrings(existing.clues.entities, next.clues.entities),
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

  /**
   * 构建书签同步对齐表（全量，不受列表 UI limit 限制）。
   * 供记忆库目录树标记是否已写入 Memory。
   */
  async listBookmarkSyncAlignment(): Promise<BookmarkSyncAlignment> {
    const items = await this.listByOwner({
      type: 'bookmark',
      limit: Number.MAX_SAFE_INTEGER
    })

    const byChromeBookmarkId = new Map<string, string>()
    const byUrl = new Map<string, string>()
    const noteByMemoryId = new Map<string, string>()

    for (const item of items) {
      if (item.type !== 'bookmark') {
        continue
      }
      const chromeId = item.payload.chromeBookmarkId?.trim()
      if (chromeId) {
        byChromeBookmarkId.set(chromeId, item.id)
      }
      const urlKey = normalizeBookmarkSyncUrl(item.payload.url)
      if (urlKey && !byUrl.has(urlKey)) {
        byUrl.set(urlKey, item.id)
      }
      const note = item.clues.note?.trim()
      if (note) {
        noteByMemoryId.set(item.id, note)
      }
    }

    return { byChromeBookmarkId, byUrl, noteByMemoryId }
  }

  /**
   * 更新 clues.note（书签/摘录事后补注）。
   * 空字符串清除备注；会更新 updatedAt。
   */
  async updateNote(id: string, note: string): Promise<MemoryItem | null> {
    const ownerId = await getCurrentOwnerId()
    const existing = await this.getById(id, ownerId)
    if (!existing) {
      return null
    }

    const trimmed = note.trim()
    const nextClues = { ...existing.clues }
    if (trimmed) {
      nextClues.note = trimmed
    } else {
      delete nextClues.note
    }

    const updated: MemoryItem = {
      ...existing,
      clues: nextClues,
      updatedAt: new Date().toISOString()
    }

    await this.put(updated)
    return updated
  }

  /** 软删除 MemoryItem。 */
  async softDelete(id: string): Promise<MemoryItem | null> {
    const ownerId = await getCurrentOwnerId()
    const existing = await this.getById(id, ownerId, { includeDeleted: true })
    if (!existing) {
      return null
    }
    if (existing.deletedAt != null) {
      return existing
    }

    const deleted: MemoryItem = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await this.put(deleted)
    return deleted
  }

  /**
   * 记录用户打开 MemoryItem。
   * 只更新 openCount / lastOpenedAt，不改 updatedAt（打开 ≠ 内容变更）。
   */
  async recordOpen(id: string, openedAt = new Date().toISOString()): Promise<MemoryItem | null> {
    const ownerId = await getCurrentOwnerId()
    const existing = await this.getById(id, ownerId)
    if (!existing) {
      return null
    }

    const next: MemoryItem = {
      ...existing,
      clues: {
        ...existing.clues,
        openCount: existing.clues.openCount + 1,
        lastOpenedAt: openedAt
      }
    }

    await this.put(next)
    return next
  }

  /**
   * 批量记录否定反馈（「都不是这些」）。
   * 只更新 dismissCount / lastDismissedAt，不改 updatedAt。
   */
  async recordDismiss(ids: string[], dismissedAt = new Date().toISOString()): Promise<number> {
    const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
    if (uniqueIds.length === 0) {
      return 0
    }

    const ownerId = await getCurrentOwnerId()
    let updated = 0
    for (const id of uniqueIds) {
      const existing = await this.getById(id, ownerId)
      if (!existing) {
        continue
      }
      const next: MemoryItem = {
        ...existing,
        clues: {
          ...existing.clues,
          dismissCount: (existing.clues.dismissCount ?? 0) + 1,
          lastDismissedAt: dismissedAt
        }
      }
      await this.put(next)
      updated += 1
    }
    return updated
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
    const items = await this.listByOwner({
      ...optionalProp('type', type),
      limit: Number.MAX_SAFE_INTEGER
    })
    return items.length
  }

  /**
   * 列出指定 owner 下全部条目（含软删可选）。
   * 同步前 remap 时需按旧 localProfileId 扫描，故允许显式传入 ownerId。
   */
  async listAllByOwnerId(
    ownerId: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<MemoryItem[]> {
    await this.ensureReady()
    const includeDeleted = options.includeDeleted ?? false

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const index = store.index(MEMORY_ITEM_INDEX_BY_OWNER)
      const range = IDBKeyRange.only(ownerId)
      const items: MemoryItem[] = []

      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range)
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
          cursor.continue()
        }
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 游标读取失败'))
      })

      return items
    })
  }

  /**
   * 将 fromOwnerId 下全部条目的 ownerId 改为 toOwnerId（保留 sourceLocalProfileId）。
   * 用于登录后「本机覆盖云端」前的归属迁移。
   */
  async remapOwnerId(fromOwnerId: string, toOwnerId: string): Promise<number> {
    if (fromOwnerId === toOwnerId) {
      return 0
    }

    const items = await this.listAllByOwnerId(fromOwnerId, { includeDeleted: true })
    if (items.length === 0) {
      return 0
    }

    const remapped = items.map(item => ({
      ...item,
      ownerId: toOwnerId
    }))
    await this.putMany(remapped)
    return remapped.length
  }

  /**
   * 用云端拉取结果覆盖本机指定 owner 的库：删除该 owner 下旧行后 putMany。
   * 调用方应保证 items 的 ownerId 已是目标账号。
   */
  async replaceOwnerItems(ownerId: string, items: MemoryItem[]): Promise<number> {
    await this.ensureReady()

    await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const index = store.index(MEMORY_ITEM_INDEX_BY_OWNER)
      const range = IDBKeyRange.only(ownerId)

      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range)
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve()
            return
          }
          void requestToPromise(cursor.delete())
            .then(() => cursor.continue())
            .catch(reject)
        }
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 删除游标失败'))
      })

      for (const item of items) {
        if (item.ownerId !== ownerId) {
          continue
        }
        await requestToPromise(store.put(MemoryItemSchema.parse(item)))
      }
    })

    return items.filter(item => item.ownerId === ownerId).length
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

  /**
   * 写回 enrichment 合并后的整条 MemoryItem（由调用方保留 updatedAt）。
   * 仅供异步 LLM / 规则回填使用，勿用于用户编辑路径。
   */
  async putEnrichmentClues(item: MemoryItem): Promise<void> {
    await this.put(item)
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
