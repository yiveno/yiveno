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
import { resolveMemoryItemSavedAtIso } from '@/core/memory/memory-item-saved-at'
import { MemoryItemSchema, safeParseMemoryItem, type MemoryItem } from '@/core/memory/memory-item'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import {
  KEYWORD_INDEX_PUT_MANY_INCREMENTAL_MAX,
  MEMORY_ITEM_INDEX_BY_OWNER,
  MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK,
  MEMORY_ITEM_INDEX_BY_OWNER_TYPE_UPDATED,
  MEMORY_ITEM_INDEX_BY_OWNER_UPDATED,
  MEMORY_ITEM_STORE
} from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import {
  extractDocumentIndexTokens,
  sameTokenSet
} from '@/core/recall/extract-document-index-tokens'

export interface ListMemoryItemsOptions {
  type?: SupportedMemoryItemType
  limit?: number
  includeDeleted?: boolean
}

/** 书签树对齐：Chrome 书签 id / URL → MemoryItem.id */
export interface BookmarkSyncAlignment {
  byChromeBookmarkId: Map<string, string>
  byUrl: Map<string, string>
  /** MemoryItem.id → 非空附注 */
  noteByMemoryId: Map<string, string>
  /** MemoryItem.id → 保存/创建时刻 ISO（书签 chromeCreatedAt 优先） */
  savedAtByMemoryId: Map<string, string>
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
      // 以 Chrome dateAdded 校正近因；无则保留原 createdAt
      createdAt: next.payload.chromeCreatedAt ?? existing.createdAt,
      clues: {
        ...next.clues,
        openCount: existing.clues.openCount,
        lastOpenedAt: existing.clues.lastOpenedAt,
        settledCount: existing.clues.settledCount,
        lastSettledAt: existing.clues.lastSettledAt,
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

  /**
   * 从第三方语料导出 upsert Bookmark（corpusSource + remoteId 幂等）。
   * 保留已有 note / 行为字段。
   */
  async upsertBookmarkFromThirdPartyCorpus(input: CreateBookmarkInput): Promise<MemoryItem> {
    const corpusSource = input.payload.corpusSource
    const remoteId = input.payload.remoteId
    if (!corpusSource || !remoteId) {
      return this.createBookmark({
        ...input,
        captureEntry: input.captureEntry ?? 'import'
      })
    }

    const ownerId = await getCurrentOwnerId()
    const existingItems = await this.listByOwner({ type: 'bookmark', limit: 5000 })
    const existing = existingItems.find(
      item =>
        item.type === 'bookmark' &&
        item.payload.corpusSource === corpusSource &&
        item.payload.remoteId === remoteId &&
        item.deletedAt == null
    )

    if (!existing || existing.type !== 'bookmark') {
      return this.createBookmark({
        ...input,
        captureEntry: input.captureEntry ?? 'import'
      })
    }

    const [profile] = await Promise.all([getOrCreateLocalProfile()])
    const next = createBookmarkMemoryItem({
      ...input,
      ownerId,
      sourceLocalProfileId: profile.localProfileId,
      captureEntry: input.captureEntry ?? existing.clues.captureEntry ?? 'import',
      now: () => new Date().toISOString()
    })

    const merged: MemoryItem = {
      ...next,
      id: existing.id,
      createdAt: next.payload.sourceCreatedAt ?? existing.createdAt,
      clues: {
        ...next.clues,
        openCount: existing.clues.openCount,
        lastOpenedAt: existing.clues.lastOpenedAt,
        settledCount: existing.clues.settledCount,
        lastSettledAt: existing.clues.lastSettledAt,
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

    const validated = items.map(item => MemoryItemSchema.parse(item))
    const previousById = new Map<string, MemoryItem>()
    for (const item of validated) {
      const previous = await this.getById(item.id, item.ownerId, { includeDeleted: true })
      if (previous) {
        previousById.set(item.id, previous)
      }
    }

    await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      for (const item of validated) {
        await requestToPromise(store.put(item))
      }
    })

    const byOwner = new Map<string, typeof validated>()
    for (const item of validated) {
      const list = byOwner.get(item.ownerId) ?? []
      list.push(item)
      byOwner.set(item.ownerId, list)
    }

    for (const [ownerId, ownerItems] of byOwner) {
      if (ownerItems.length > KEYWORD_INDEX_PUT_MANY_INCREMENTAL_MAX) {
        await keywordIndexRepository.markDirty(ownerId)
        continue
      }

      const diffs = ownerItems.map(item => {
        const previous = previousById.get(item.id)
        return {
          itemId: item.id,
          previousTokens: previous ? extractDocumentIndexTokens(previous) : [],
          nextTokens: extractDocumentIndexTokens(item)
        }
      })

      const hasChange = diffs.some(diff => !sameTokenSet(diff.previousTokens, diff.nextTokens))
      if (!hasChange) {
        continue
      }

      const applied = await keywordIndexRepository.applyItemTokenDiffs({
        ownerId,
        diffs
      })
      if (!applied.applied) {
        await keywordIndexRepository.markDirty(ownerId)
      }
    }
  }

  /** 按 id 批量读取（保持 ids 顺序；缺省/软删跳过）。 */
  async getManyByIds(
    ids: readonly string[],
    ownerId?: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<MemoryItem[]> {
    if (ids.length === 0) {
      return []
    }

    await this.ensureReady()
    const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())
    const includeDeleted = options.includeDeleted ?? false

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const items: MemoryItem[] = []
      for (const id of ids) {
        const raw = await requestToPromise(store.get(id))
        const item = safeParseMemoryItem(raw)
        if (!item || item.ownerId !== resolvedOwnerId) {
          continue
        }
        if (!includeDeleted && item.deletedAt != null) {
          continue
        }
        items.push(item)
      }
      return items
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
    const savedAtByMemoryId = new Map<string, string>()

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
      savedAtByMemoryId.set(item.id, resolveMemoryItemSavedAtIso(item))
    }

    return { byChromeBookmarkId, byUrl, noteByMemoryId, savedAtByMemoryId }
  }

  /**
   * 更新 clues.note（书签/摘录事后补注）。
   * 空字符串清除附注；会更新 updatedAt。
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

  /**
   * 断开 Bookmark 与 Chrome 书签 id 的链接（清探针文件夹前保留 Memory）。
   */
  async detachChromeBookmarkLink(id: string): Promise<MemoryItem | null> {
    const ownerId = await getCurrentOwnerId()
    const existing = await this.getById(id, ownerId)
    if (!existing || existing.type !== 'bookmark') {
      return null
    }
    if (!existing.payload.chromeBookmarkId?.trim()) {
      return existing
    }

    const payloadRest = { ...existing.payload }
    delete payloadRest.chromeBookmarkId
    delete payloadRest.parentFolderId
    const updated: MemoryItem = {
      ...existing,
      payload: payloadRest,
      updatedAt: new Date().toISOString()
    }
    await this.put(updated)
    return updated
  }

  /**
   * DEV：回溯保存时刻（createdAt；书签同步 chromeCreatedAt）。
   * 不改 updatedAt（内容未变）；供 TTE 冷却手测。
   */
  async setSavedAtForDev(
    id: string,
    savedAtIso: string,
    ownerId?: string
  ): Promise<MemoryItem | null> {
    const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())
    const existing = await this.getById(id, resolvedOwnerId, { includeDeleted: true })
    if (!existing || existing.deletedAt != null) {
      return null
    }

    if (existing.type === 'bookmark') {
      const updated: MemoryItem = {
        ...existing,
        createdAt: savedAtIso,
        payload: {
          ...existing.payload,
          chromeCreatedAt: savedAtIso
        }
      }
      await this.put(updated)
      return updated
    }

    const updated: MemoryItem = {
      ...existing,
      createdAt: savedAtIso
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
   * 记录 Recall settled 正例（§7.2）。
   * 只更新 settledCount / lastSettledAt，不改 updatedAt（结算 ≠ 内容变更）。
   */
  async recordSettle(id: string, settledAt = new Date().toISOString()): Promise<MemoryItem | null> {
    const ownerId = await getCurrentOwnerId()
    const existing = await this.getById(id, ownerId)
    if (!existing) {
      return null
    }

    const next: MemoryItem = {
      ...existing,
      clues: {
        ...existing.clues,
        settledCount: (existing.clues.settledCount ?? 0) + 1,
        lastSettledAt: settledAt
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

  /**
   * 按 Chrome 书签 ID 软删除全部匹配的 Bookmark MemoryItem。
   * 索引非唯一时可能残留多行（种库+同步叠写）；只删一条会留下脏 URL。
   */
  async softDeleteByChromeBookmarkId(chromeBookmarkId: string): Promise<MemoryItem | null> {
    await this.ensureReady()
    const ownerId = await getCurrentOwnerId()
    const matches = await indexedDBManager.withTransaction(
      MEMORY_ITEM_STORE,
      'readonly',
      async transaction => {
        const index = transaction
          .objectStore(MEMORY_ITEM_STORE)
          .index(MEMORY_ITEM_INDEX_BY_OWNER_CHROME_BOOKMARK)
        const raws = await requestToPromise(index.getAll([ownerId, chromeBookmarkId]))
        const list = Array.isArray(raws) ? raws : raws == null ? [] : [raws]
        return list
          .map(raw => safeParseMemoryItem(raw))
          .filter((item): item is MemoryItem => {
            return (
              item != null &&
              item.ownerId === ownerId &&
              item.deletedAt == null &&
              item.type === 'bookmark'
            )
          })
      }
    )
    if (matches.length === 0) {
      return null
    }
    let last: MemoryItem | null = null
    for (const item of matches) {
      last = await this.softDelete(item.id)
    }
    return last
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
   * 扫描全库，按 ownerId 汇总条数（含软删计入 total；active 为未软删）。
   * 供孤儿桶盘点：保留集外的 owner 即历史换号残留。
   */
  async listOwnerBucketSummaries(): Promise<
    Array<{
      ownerId: string
      /** 未软删条数 */
      activeCount: number
      /** 含软删总条数 */
      totalCount: number
    }>
  > {
    await this.ensureReady()

    return indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      const tallies = new Map<string, { activeCount: number; totalCount: number }>()

      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve()
            return
          }
          const item = safeParseMemoryItem(cursor.value)
          if (item) {
            const prev = tallies.get(item.ownerId) ?? { activeCount: 0, totalCount: 0 }
            prev.totalCount += 1
            if (item.deletedAt == null) {
              prev.activeCount += 1
            }
            tallies.set(item.ownerId, prev)
          }
          cursor.continue()
        }
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 游标读取失败'))
      })

      return [...tallies.entries()].map(([ownerId, counts]) => ({
        ownerId,
        activeCount: counts.activeCount,
        totalCount: counts.totalCount
      }))
    })
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
   * 用于：登录后归并未登录本地档；以及「本机覆盖云端」前的归属迁移。
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
    // 旧 owner 的 posting 失效；目标 owner 已由 putMany 标 dirty
    await keywordIndexRepository.clearOwnerIndex(fromOwnerId)
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

    await keywordIndexRepository.clearOwnerIndex(ownerId)

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

  /**
   * 物理删除若干条目（腾配额；软删不释放磁盘）。
   * 同步更新倒排；失败标 dirty。
   */
  async hardDeleteMany(ids: string[]): Promise<number> {
    const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
    if (uniqueIds.length === 0) {
      return 0
    }

    await this.ensureReady()
    const ownerId = await getCurrentOwnerId()
    let deleted = 0

    for (const id of uniqueIds) {
      const existing = await this.getById(id, ownerId, { includeDeleted: true })
      if (!existing || existing.ownerId !== ownerId) {
        continue
      }
      const previousTokens = extractDocumentIndexTokens(existing)
      await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
        const store = transaction.objectStore(MEMORY_ITEM_STORE)
        await requestToPromise(store.delete(id))
      })
      deleted += 1
      if (previousTokens.length > 0) {
        const applied = await keywordIndexRepository.applyItemTokenDiff({
          ownerId,
          itemId: id,
          previousTokens,
          nextTokens: []
        })
        if (!applied.applied) {
          await keywordIndexRepository.markDirty(ownerId)
        }
      }
    }

    return deleted
  }

  private async put(item: MemoryItem): Promise<void> {
    await this.ensureReady()
    const validated = MemoryItemSchema.parse(item)

    const previous = await this.getById(validated.id, validated.ownerId, { includeDeleted: true })
    const previousTokens = previous ? extractDocumentIndexTokens(previous) : []
    const nextTokens = extractDocumentIndexTokens(validated)
    const tokensChanged = !sameTokenSet(previousTokens, nextTokens)

    await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_ITEM_STORE)
      await requestToPromise(store.put(validated))
    })

    if (tokensChanged) {
      const applied = await keywordIndexRepository.applyItemTokenDiff({
        ownerId: validated.ownerId,
        itemId: validated.id,
        previousTokens,
        nextTokens
      })
      if (!applied.applied) {
        await keywordIndexRepository.markDirty(validated.ownerId)
      }
    }
  }
}

export const memoryItemRepository = new MemoryItemRepository()
