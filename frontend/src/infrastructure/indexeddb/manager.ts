/**
 * IndexedDB 管理器（架构迁移版）
 *
 * 职责：
 * - 向上提供统一的数据库访问接口；
 * - 当前阶段通过 `ports` 适配 legacy 实现，逐步替换为原生实现；
 * - 在迁移过程中保持 API 稳定，便于 DDD 各层调用。
 */

import type {
  AppSettings,
  BatchOptions,
  BookmarkRecord,
  DatabaseHealth,
  DatabaseStats,
  FaviconCacheRecord,
  GlobalStats,
  SearchHistoryRecord,
  SearchOptions,
  SearchResult
} from './types'
import type { TraitMetadata } from './types/bookmark-record'

export type {
  AppSettings,
  BatchOptions,
  BookmarkRecord,
  DatabaseHealth,
  DatabaseStats,
  FaviconCacheRecord,
  GlobalStats,
  SearchHistoryRecord,
  SearchOptions,
  SearchResult
}

export { DB_CONFIG, INDEX_CONFIG } from './schema'
import { DB_CONFIG } from './schema'
import { TIMEOUT_CONFIG } from '@/config/constants'
import {
  BookmarkRecordArraySchema,
  BookmarkRecordSchema,
  BookmarkSearchOptionsSchema,
  BookmarkSearchResultArraySchema,
  migrateTraitTags,
  migrateTraitMetadata
} from './validation/records'

import {
  withTransaction,
  type IDBTransactionMode,
  type TransactionOptions
} from './transaction-manager'
import { idbConnectionPool } from './connection-pool'
import { logger } from '@/infrastructure/logging/logger'
import { monitorOperation } from './performance-monitor'

type StoreName = (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES]
export type StoreDump = Record<StoreName, unknown[]>
const cloneValue = <T>(value: T): T => {
  const cloner = globalThis.structuredClone
  if (typeof cloner === 'function') {
    return cloner(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * IndexedDB 管理器
 *
 * 当前实现已逐步替换 legacy 逻辑，并直接落在基础设施层。
 */
export class IndexedDBManager {
  private readonly storeNames = Object.values(DB_CONFIG.STORES) as StoreName[]
  /** 各数据表的主键配置 */
  private readonly storePrimaryKeyMap: Record<
    (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
    IDBObjectStoreParameters | undefined
  > = {
    [DB_CONFIG.STORES.BOOKMARKS]: { keyPath: 'id' },
    [DB_CONFIG.STORES.GLOBAL_STATS]: { keyPath: 'key' },
    [DB_CONFIG.STORES.SETTINGS]: { keyPath: 'key' },
    [DB_CONFIG.STORES.SEARCH_HISTORY]: { keyPath: 'id', autoIncrement: true },
    [DB_CONFIG.STORES.FAVICON_CACHE]: { keyPath: 'domain' },
    [DB_CONFIG.STORES.FAVICON_STATS]: { keyPath: 'key' },
    [DB_CONFIG.STORES.EMBEDDINGS]: { keyPath: 'bookmarkId' },
    [DB_CONFIG.STORES.FOLDER_VECTORS]: { keyPath: 'folderId' }, // 新增：文件夹向量存储
    [DB_CONFIG.STORES.AI_JOBS]: { keyPath: 'id' }
  }

  /** 各数据表的索引配置 */
  private readonly storeIndexConfigMap: Record<
    (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
    Array<{
      name: string
      keyPath: string | string[]
      options?: IDBIndexParameters
    }>
  > = {
    [DB_CONFIG.STORES.BOOKMARKS]: [
      { name: 'parentId', keyPath: 'parentId' },
      { name: 'url', keyPath: 'url' },
      { name: 'urlLower', keyPath: 'urlLower' },
      { name: 'domain', keyPath: 'domain' },
      { name: 'titleLower', keyPath: 'titleLower' },
      { name: 'parentId_index', keyPath: ['parentId', 'index'] },
      { name: 'pathIds', keyPath: 'pathIds', options: { multiEntry: true } },
      { name: 'keywords', keyPath: 'keywords', options: { multiEntry: true } },
      { name: 'tags', keyPath: 'tags', options: { multiEntry: true } },
      {
        name: 'traitTags',
        keyPath: 'traitTags',
        options: { multiEntry: true }
      },
      { name: 'isInvalid', keyPath: 'isInvalid' },
      { name: 'isDuplicate', keyPath: 'isDuplicate' },
      { name: 'dateAdded', keyPath: 'dateAdded' }
    ],
    [DB_CONFIG.STORES.GLOBAL_STATS]: [
      { name: 'key', keyPath: 'key' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.SETTINGS]: [
      { name: 'updatedAt', keyPath: 'updatedAt' },
      { name: 'type', keyPath: 'type' }
    ],
    [DB_CONFIG.STORES.SEARCH_HISTORY]: [
      { name: 'query', keyPath: 'query' },
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'source', keyPath: 'source' }
    ],
    [DB_CONFIG.STORES.FAVICON_CACHE]: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'lastAccessed', keyPath: 'lastAccessed' },
      { name: 'accessCount', keyPath: 'accessCount' },
      { name: 'bookmarkCount', keyPath: 'bookmarkCount' },
      { name: 'isPopular', keyPath: 'isPopular' },
      { name: 'quality', keyPath: 'quality' },
      { name: 'expiresAt', keyPath: 'expiresAt' }
    ],
    [DB_CONFIG.STORES.FAVICON_STATS]: [
      { name: 'key', keyPath: 'key' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.EMBEDDINGS]: [
      { name: 'bookmarkId', keyPath: 'bookmarkId' },
      { name: 'domain', keyPath: 'domain' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.FOLDER_VECTORS]: [
      { name: 'folderId', keyPath: 'folderId' },
      { name: 'folderName', keyPath: 'folderName' },
      { name: 'bookmarkCount', keyPath: 'bookmarkCount' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ],
    [DB_CONFIG.STORES.AI_JOBS]: [
      { name: 'status', keyPath: 'status' },
      { name: 'type', keyPath: 'type' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ]
  }
  private db: IDBDatabase | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null

  /**
   * 将原生 IDBRequest 封装为 Promise。
   *
   * @description
   * IndexedDB 的 API 以事件回调为主，不便于统一错误处理。
   * 通过该方法可将成功与失败回调转换为 Promise，便于上层逻辑使用 async/await。
   *
   * @param request 需要监听的 IDBRequest 实例
   * @returns 成功时返回请求结果，失败时抛出错误
   */
  private async wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'))
    })
  }

  /**
   * 初始化数据库连接。
   *
   * - 避免重复初始化：若已经完成直接返回，若存在正在进行的初始化则复用同一个 Promise。
   * - 初始化失败时会重置状态，防止 db 保持在半初始化状态。
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      try {
        await this.openDatabase()
      } catch (error) {
        logger.error('IndexedDBManager', 'initialize 失败', error)
        this.isInitialized = false
        if (this.db) {
          this.db.close()
          this.db = null
        }
        throw error
      } finally {
        this.initPromise = null
      }
    })()

    await this.initPromise
    await this.autoEnsureGlobalStats()
  }

  /**
   * 打开数据库并在版本升级时创建/迁移对象存储。
   *
   * @throws 初始化超时、失败或升级阻塞时抛出错误
   */
  private async openDatabase(): Promise<void> {
    const { NAME, VERSION } = DB_CONFIG

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(NAME, VERSION)
      const openTimeout = globalThis.setTimeout(() => {
        const timeoutError = new Error('IndexedDB 初始化超时')
        logger.error('IndexedDBManager', 'openDatabase 超时', timeoutError)
        reject(timeoutError)
      }, 10_000)

      request.onerror = () => {
        globalThis.clearTimeout(openTimeout)
        const error = request.error ?? new Error('IndexedDB 初始化失败')
        logger.error('IndexedDBManager', 'openDatabase onerror', error)
        reject(error)
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (!tx) {
          const upgradeError = new Error('IndexedDB 升级事务缺失')
          logger.error('IndexedDBManager', 'openDatabase 升级事务缺失', upgradeError)
          reject(upgradeError)
          return
        }
        this.createStores(db, tx)
      }

      request.onsuccess = () => {
        globalThis.clearTimeout(openTimeout)
        this.db = request.result
        idbConnectionPool.setDB(this.db)
        this.isInitialized = true
        logger.info('IndexedDBManager', 'openDatabase 成功', {
          name: NAME,
          version: VERSION,
          stores: Array.from(this.db.objectStoreNames)
        })
        resolve()
      }

      request.onblocked = () => {
        globalThis.clearTimeout(openTimeout)
        const blockedError = new Error('IndexedDB 升级被阻塞')
        logger.warn('IndexedDBManager', 'openDatabase 升级被阻塞')
        reject(blockedError)
      }
    })
  }

  /**
   * 根据 schema 创建或修复对象存储与索引。
   *
   * - 首次升级时按配置创建缺失的 store。
   * - 若 store 已存在，继续校验其索引配置，确保与最新 schema 对齐。
   */
  private createStores(db: IDBDatabase, tx: IDBTransaction): void {
    this.storeNames.forEach(storeName => {
      const primaryKeyOptions = this.storePrimaryKeyMap[storeName]

      if (!db.objectStoreNames.contains(storeName)) {
        const store = primaryKeyOptions
          ? db.createObjectStore(storeName, primaryKeyOptions)
          : db.createObjectStore(storeName)
        this.ensureIndexes(storeName, store)
        return
      }

      const store = tx.objectStore(storeName)
      this.ensureIndexes(storeName, store)
    })
  }

  /**
   * 为指定对象存储补齐缺失索引并移除废弃索引。
   *
   * @param storeName 对象存储名称
   * @param store 对象存储实例
   */
  private ensureIndexes(
    storeName: (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES],
    store: IDBObjectStore
  ): void {
    const indexConfigs = this.storeIndexConfigMap[storeName]
    if (!indexConfigs) return

    const existingIndexes = new Set(Array.from(store.indexNames))
    indexConfigs.forEach(indexConfig => {
      if (!existingIndexes.has(indexConfig.name)) {
        store.createIndex(indexConfig.name, indexConfig.keyPath, indexConfig.options)
      }
    })

    existingIndexes.forEach(indexName => {
      if (!indexConfigs.some(indexConfig => indexConfig.name === indexName)) {
        store.deleteIndex(indexName)
      }
    })
  }

  /**
   * 确保数据库连接已准备完成。
   *
   * @throws 若初始化尚未完成或初始化失败，主动抛错提醒调用方
   */
  private async ensureReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.db || !this.isInitialized) {
      throw new Error('IndexedDBManager 未能成功初始化数据库连接')
    }
  }

  /**
   * 通用事务封装。
   *
   * @description
   * 所有访问逻辑均需通过该方法运行，以确保：
   * 1. 数据库已初始化。
   * 2. 统一使用 transaction-manager 中的重试/回退策略。
   *
   * @param stores 参与事务的对象存储列表
   * @param mode 事务模式（readonly/readwrite）
   * @param handler 事务执行逻辑，由调用方传入
   * @param options 可选的事务配置（重试次数、超时等）
   */
  private async runTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    handler: (tx: IDBTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    await this.ensureReady()
    return withTransaction(stores, mode, handler, options)
  }

  /**
   * 只读事务的快捷调用。
   */
  private async runReadTransaction<T>(
    store: string,
    handler: (tx: IDBTransaction, objectStore: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    return this.runTransaction([store], 'readonly', async tx => {
      const objectStore = tx.objectStore(store)
      return handler(tx, objectStore)
    })
  }

  /**
   * 可写事务的快捷调用。
   */
  private async runWriteTransaction<T>(
    store: string,
    handler: (tx: IDBTransaction, objectStore: IDBObjectStore) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.runTransaction(
      [store],
      'readwrite',
      async tx => {
        const objectStore = tx.objectStore(store)
        return handler(tx, objectStore)
      },
      options
    )
  }

  /**
   * 批量操作工具。
   *
   * @description
   * 将大批量数据按指定批次执行写事务，同时提供进度与错误回调，
   * 便于调用方实现可视化进度刷新与错误兜底。
   */
  private async runBatchOperation<T>(
    items: T[],
    storeName: string,
    executor: (store: IDBObjectStore, item: T) => Promise<void>,
    options: BatchOptions<T> = {}
  ): Promise<void> {
    if (items.length === 0) return

    const total = items.length
    const batchSize = this.resolveBatchSize(total, options.batchSize)
    let processed = 0

    for (let start = 0; start < total; start += batchSize) {
      const chunk = items.slice(start, Math.min(start + batchSize, total))

      try {
        await this.runWriteTransaction(storeName, async (_tx, store) => {
          await Promise.all(
            chunk.map(async item => {
              try {
                await executor(store, item)
              } catch (error) {
                const normalizedError =
                  error instanceof Error ? error : new Error(String(error ?? '未知错误'))
                options.errorCallback?.(normalizedError, item)
                throw normalizedError
              }
            })
          )
        })

        processed += chunk.length
        options.progressCallback?.(processed, total)
      } catch (error) {
        throw error
      }

      if (options.delayBetweenBatches) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenBatches))
      }
    }
  }

  private resolveBatchSize(total: number, preferred?: number): number {
    if (preferred && preferred > 0) {
      return preferred
    }
    return this.calculateOptimalBatchSize(total)
  }

  private calculateOptimalBatchSize(totalRecords: number): number {
    const memoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    const baseBatchSize = (memoryGB || 4) >= 8 ? 5000 : 2000

    if (totalRecords < 1000) return totalRecords
    if (totalRecords > 100_000) return Math.min(baseBatchSize, 1000)
    return baseBatchSize
  }

  /**
   * 让出事件循环控制权
   *
   * 在长时间运行的操作中定期调用，避免阻塞 UI
   *
   * @example
   * ```ts
   * for (let i = 0; i < largeArray.length; i++) {
   *   processItem(largeArray[i])
   *   if (i % 100 === 0) await this.yieldToEventLoop()
   * }
   * ```
   *
   * @internal 预留方法，供未来性能优化使用
   */
  // @ts-expect-error - 预留方法，供未来性能优化使用
  private async yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => {
      const idle = (
        globalThis as typeof globalThis & {
          requestIdleCallback?: (
            callback: IdleRequestCallback,
            options?: IdleRequestOptions
          ) => number
        }
      ).requestIdleCallback

      if (typeof idle === 'function') {
        idle(() => resolve())
      } else {
        globalThis.setTimeout(resolve, TIMEOUT_CONFIG.DELAY.IMMEDIATE)
      }
    })
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
    this.initPromise = null
  }

  async withTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    handler: (tx: IDBTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.runTransaction(stores, mode, handler, options)
  }

  /**
   * 批量导入书签数据。
   *
   * @param bookmarks 待写入的书签集合
   * @param options 批量处理配置
   */
  async insertBookmarks(
    bookmarks: BookmarkRecord[],
    options?: BatchOptions<BookmarkRecord>
  ): Promise<void> {
    if (bookmarks.length === 0) return

    const parsed = BookmarkRecordArraySchema.safeParse(bookmarks)
    if (!parsed.success) {
      logger.error('IndexedDBManager', 'insertBookmarks 数据校验失败', parsed.error)
      throw parsed.error
    }

    // ✅ 先获取所有现有书签，用于保留自定义字段（如收藏状态）
    const existingBookmarks = await this.getAllBookmarks()
    const existingMap = new Map(existingBookmarks.map(b => [b.id, b]))

    await this.runBatchOperation(
      parsed.data.map(record => {
        const existing = existingMap.get(record.id)
        return {
          ...record,
          traitTags: record.traitTags ?? [],
          traitMetadata: (record.traitMetadata ?? []) as TraitMetadata[],
          // ✅ 保留现有的自定义字段（收藏状态、特征检测结果等）
          isFavorite: existing?.isFavorite ?? record.isFavorite,
          favoriteOrder: existing?.favoriteOrder ?? record.favoriteOrder,
          favoritedAt: existing?.favoritedAt ?? record.favoritedAt,
          notes: existing?.notes ?? record.notes,
          lastVisited: existing?.lastVisited ?? record.lastVisited,
          visitCount: existing?.visitCount ?? record.visitCount
        }
      }) as BookmarkRecord[],
      DB_CONFIG.STORES.BOOKMARKS,
      async (store, bookmark) => {
        await this.wrapRequest(store.put(bookmark))
      },
      options
    )
  }

  /**
   * 更新单条书签信息。
   */
  async updateBookmark(bookmark: BookmarkRecord): Promise<void> {
    const parsed = BookmarkRecordSchema.safeParse(bookmark)
    if (!parsed.success) {
      logger.error('IndexedDBManager', 'updateBookmark 数据校验失败', parsed.error)
      throw parsed.error
    }

    await this.runWriteTransaction(DB_CONFIG.STORES.BOOKMARKS, async (_tx, store) => {
      const record = {
        ...parsed.data,
        traitTags: parsed.data.traitTags ?? [],
        traitMetadata: (parsed.data.traitMetadata ?? []) as TraitMetadata[]
      } as BookmarkRecord
      await this.wrapRequest(store.put(record))
    })
  }

  async updateBookmarksTraits(
    updates: Array<{
      id: string
      traitTags: string[]
      traitMetadata?: BookmarkRecord['traitMetadata']
    }>
  ): Promise<void> {
    if (updates.length === 0) return

    await this.runWriteTransaction(DB_CONFIG.STORES.BOOKMARKS, async (_tx, store) => {
      for (const update of updates) {
        try {
          const existing = (await this.wrapRequest(store.get(update.id))) as
            | BookmarkRecord
            | undefined
          if (!existing) continue

          // ✅ 数据迁移：清理旧的特征标签和元数据
          const migratedTags = migrateTraitTags(update.traitTags) ?? []
          const migratedMetadata = migrateTraitMetadata(update.traitMetadata)

          const nextRecord: BookmarkRecord = {
            ...existing,
            traitTags: migratedTags,
            traitMetadata: migratedMetadata ?? []
          }

          const parsed = BookmarkRecordSchema.safeParse(nextRecord)
          if (!parsed.success) {
            logger.error('IndexedDBManager', 'updateBookmarksTraits 数据校验失败', {
              bookmarkId: update.id,
              error: parsed.error,
              // 添加更多调试信息
              originalTraitTags: update.traitTags,
              migratedTraitTags: migratedTags,
              originalMetadata: update.traitMetadata,
              migratedMetadata: migratedMetadata
            })
            continue
          }

          await this.wrapRequest(store.put(parsed.data))
        } catch (error) {
          logger.error('IndexedDBManager', '更新特征标签失败', {
            bookmarkId: update.id,
            error
          })
        }
      }
    })
  }

  /**
   * 删除指定书签。
   */
  async deleteBookmark(id: string): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.BOOKMARKS, async (_tx, store) => {
      await this.wrapRequest(store.delete(id))
    })
  }

  /**
   * 批量删除书签。
   */
  async deleteBookmarksBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    await this.runWriteTransaction(DB_CONFIG.STORES.BOOKMARKS, async (_tx, store) => {
      await Promise.all(ids.map(async id => await this.wrapRequest(store.delete(id))))
    })
  }

  /**
   * 根据主键读取书签。
   */
  async getBookmarkById(id: string): Promise<BookmarkRecord | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => await this.wrapRequest(store.get(id))
    )

    if (!result) return null

    const parsed = BookmarkRecordSchema.safeParse(result)
    if (!parsed.success) {
      logger.error('IndexedDBManager', 'getBookmarkById 校验失败', {
        id,
        error: parsed.error
      })
      return null
    }

    return {
      ...parsed.data,
      traitTags: parsed.data.traitTags ?? [],
      traitMetadata: (parsed.data.traitMetadata ?? []) as TraitMetadata[]
    } as BookmarkRecord
  }

  /**
   * 根据 URL（不区分大小写）查询所有匹配的书签。
   *
   * 用于重复检测等场景，通过 urlLower 索引高效查询。
   *
   * @param url - 要查询的 URL（会自动转换为小写）
   * @returns 匹配的书签记录数组
   */
  async getBookmarksByUrl(url: string): Promise<BookmarkRecord[]> {
    if (!url) return []

    const urlLower = url.toLowerCase().trim()
    if (!urlLower) return []

    const results = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        // 使用 urlLower 索引进行精确查询
        const index = store.index('urlLower')
        const request = index.openCursor(IDBKeyRange.only(urlLower))
        const bookmarks: BookmarkRecord[] = []

        await new Promise<void>((resolve, reject) => {
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor) {
              resolve()
              return
            }

            const parsed = BookmarkRecordSchema.safeParse(cursor.value)
            if (!parsed.success) {
              reject(parsed.error)
              return
            }

            bookmarks.push({
              ...parsed.data,
              traitTags: parsed.data.traitTags ?? [],
              traitMetadata: (parsed.data.traitMetadata ?? []) as TraitMetadata[]
            } as BookmarkRecord)
            cursor.continue()
          }

          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB 查询失败'))
          }
        })

        return bookmarks
      }
    )

    return results
  }

  /**
   * 读取所有书签
   *
   * @param limit - 可选的返回数量限制
   * @param offset - 可选的偏移量（用于分页）
   * @returns 书签记录数组
   */
  /**
   * 获取最近访问的书签
   * @param limit 返回数量限制，默认 10 条
   * @returns 按访问时间倒序排列的书签列表
   */
  async getRecentVisits(limit: number = 10): Promise<BookmarkRecord[]> {
    const allBookmarks = await this.getAllBookmarks()

    return allBookmarks
      .filter(b => !b.isFolder && b.lastVisited) // 只要书签，且有访问记录
      .sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0)) // 按时间倒序
      .slice(0, limit) // 取前 N 条
  }

  async getAllBookmarks(limit?: number, offset?: number): Promise<BookmarkRecord[]> {
    return await monitorOperation(
      'read',
      DB_CONFIG.STORES.BOOKMARKS,
      async () => {
        const result = await this.runReadTransaction(
          DB_CONFIG.STORES.BOOKMARKS,
          async (_tx, store) => await this.wrapRequest(store.getAll())
        )

        const parsed = BookmarkRecordArraySchema.safeParse(result)
        if (!parsed.success) {
          logger.error('IndexedDBManager', 'getAllBookmarks 校验失败', parsed.error)
          throw parsed.error
        }

        // ✅ 严格按照 Chrome 原始顺序：先按 parentId 分组，再按 index 排序
        // 这样保证树的构建顺序与 Chrome 完全一致
        let data = parsed.data.map(
          record =>
            ({
              ...record,
              traitTags: record.traitTags ?? [],
              traitMetadata: (record.traitMetadata ?? []) as TraitMetadata[]
            }) as BookmarkRecord
        )

        // ✅ 按 parentId（字符串）+ index（数字）排序，严格复制 Chrome 的书签树顺序
        data.sort((a, b) => {
          const parentA = a.parentId ?? '0'
          const parentB = b.parentId ?? '0'
          // 先按 parentId 排序（同一父节点的子节点会聚集在一起）
          if (parentA !== parentB) {
            return parentA.localeCompare(parentB)
          }
          // 同一父节点下，按 index 排序（保持 Chrome 的顺序）
          const indexA = typeof a.index === 'number' ? a.index : 0
          const indexB = typeof b.index === 'number' ? b.index : 0
          return indexA - indexB
        })

        // 应用分页
        if (offset !== undefined && offset > 0) {
          data = data.slice(offset)
        }
        if (limit !== undefined && limit > 0) {
          data = data.slice(0, limit)
        }

        return data
      },
      limit
    )
  }

  /**
   * 获取指定父节点下的直接子节点
   *
   * @param parentId - 父节点ID
   * @param offset - 可选的偏移量，默认为 0
   * @param limit - 可选的返回数量限制
   * @returns 子节点记录数组
   */
  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<BookmarkRecord[]> {
    const allChildren = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) =>
        await new Promise<BookmarkRecord[]>((resolve, reject) => {
          const index = store.index('parentId')
          const request = index.openCursor(IDBKeyRange.only(parentId))
          const results: BookmarkRecord[] = []

          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor) {
              resolve(results)
              return
            }

            const parsed = BookmarkRecordSchema.safeParse(cursor.value)
            if (!parsed.success) {
              reject(parsed.error)
              return
            }

            results.push({
              ...parsed.data,
              traitTags: parsed.data.traitTags ?? [],
              traitMetadata: (parsed.data.traitMetadata ?? []) as TraitMetadata[]
            } as BookmarkRecord)
            cursor.continue()
          }

          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB 游标遍历失败'))
          }
        })
    )

    // ✅ 按 index 字段排序，与 Chrome 原生书签管理器保持一致
    allChildren.sort((a, b) => {
      const indexA = typeof a.index === 'number' ? a.index : 0
      const indexB = typeof b.index === 'number' ? b.index : 0
      return indexA - indexB
    })

    // 应用分页
    let data = allChildren
    const effectiveOffset = offset ?? 0
    if (effectiveOffset > 0) {
      data = data.slice(effectiveOffset)
    }
    if (limit !== undefined && limit > 0) {
      data = data.slice(0, limit)
    }

    return data
  }

  /**
   * 书签筛选。
   *
   * @description
   * 综合使用多种索引（标题、URL、标签等）获取候选结果，再按评分排序返回。
   * 支持精确/模糊匹配、最小得分过滤等。
   */
  async searchBookmarks(
    query: string,
    options: SearchOptions = { query }
  ): Promise<SearchResult[]> {
    const parsedOptions = BookmarkSearchOptionsSchema.safeParse({
      query,
      limit: options.limit,
      includeDomain: options.includeDomain,
      includeUrl: options.includeUrl,
      includeKeywords: options.includeKeywords,
      includeTags: options.includeTags,
      includeContent: options.includeContent,
      minScore: options.minScore,
      sortBy: options.sortBy,
      exactMatch: options.exactMatch,
      fuzzyMatch: options.fuzzyMatch
    })

    if (!parsedOptions.success) {
      logger.error('IndexedDBManager', 'searchBookmarks 参数校验失败', parsedOptions.error)
      throw parsedOptions.error
    }

    const normalized = parsedOptions.data
    const matches = await this.runReadTransaction(
      DB_CONFIG.STORES.BOOKMARKS,
      async (_tx, store) => {
        const terms = normalized.query.toLowerCase().split(/\s+/).filter(Boolean)

        if (terms.length === 0) return []

        const indexes = this.buildSearchIndexes(normalized as SearchOptions, store)
        const candidateMap = await this.collectCandidateBookmarks(
          store,
          indexes,
          terms,
          normalized.limit ?? 100
        )
        const scored = this.scoreAndFilterCandidates(
          candidateMap,
          terms,
          normalized as SearchOptions
        )
        const sorted = this.sortSearchResults(scored, normalized.sortBy)
        const limited = this.limitSearchResults(sorted, normalized.limit)

        return limited
      }
    )

    const validated = BookmarkSearchResultArraySchema.safeParse(matches)
    if (!validated.success) {
      logger.error('IndexedDBManager', 'searchBookmarks 结果校验失败', validated.error)
      throw validated.error
    }

    return validated.data.map(result => ({
      ...result,
      bookmark: {
        ...result.bookmark,
        traitTags: result.bookmark.traitTags ?? [],
        traitMetadata: result.bookmark.traitMetadata ?? []
      }
    })) as SearchResult[]
  }

  private calculateSearchScore(
    record: BookmarkRecord,
    terms: string[],
    options: SearchOptions
  ): number {
    let score = 0

    for (const term of terms) {
      if (record.titleLower.includes(term)) {
        score += record.titleLower.startsWith(term) ? 100 : 50
      }

      if (options.includeUrl && record.urlLower?.includes(term)) {
        score += 30
      }

      if (options.includeDomain && record.domain?.includes(term)) {
        score += 20
      }

      if (options.includeKeywords) {
        if (record.keywords.some(keyword => keyword.includes(term))) {
          score += 15
        }
      }

      if (options.includeTags) {
        if (record.tags.some(tag => tag.toLowerCase().includes(term))) {
          score += 10
        }
      }
    }

    return score
  }

  async updateGlobalStats(stats: GlobalStats): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.GLOBAL_STATS, async (_tx, store) => {
      const normalized: GlobalStats = {
        key: stats.key ?? 'basic',
        id: stats.id ?? stats.key ?? 'basic',
        totalBookmarks: stats.totalBookmarks ?? 0,
        totalFolders: stats.totalFolders ?? 0,
        totalDomains: stats.totalDomains ?? 0,
        lastUpdated: Date.now(),
        dataVersion: stats.dataVersion ?? DB_CONFIG.VERSION
      }

      await this.wrapRequest(store.put(normalized))
    })
  }

  async getGlobalStats(): Promise<GlobalStats> {
    const result = (await this.runReadTransaction(
      DB_CONFIG.STORES.GLOBAL_STATS,
      async (_tx, store) => await this.wrapRequest(store.get('basic'))
    )) as GlobalStats | null

    if (result && typeof result.totalBookmarks === 'number') {
      return {
        key: result.key ?? 'basic',
        id: result.id ?? result.key ?? 'basic',
        totalBookmarks: result.totalBookmarks,
        totalFolders: result.totalFolders ?? 0,
        totalDomains: result.totalDomains ?? 0,
        lastUpdated: result.lastUpdated ?? Date.now(),
        dataVersion: result.dataVersion ?? DB_CONFIG.VERSION
      }
    }

    return {
      key: 'basic',
      id: 'basic',
      totalBookmarks: 0,
      totalFolders: 0,
      totalDomains: 0,
      lastUpdated: Date.now(),
      dataVersion: DB_CONFIG.VERSION
    }
  }

  private async autoEnsureGlobalStats(): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.GLOBAL_STATS, async (_tx, store) => {
      const existing = (await this.wrapRequest(store.get('basic'))) as GlobalStats | undefined

      if (existing && typeof existing.totalBookmarks === 'number') {
        return
      }

      await this.wrapRequest(
        store.put({
          key: 'basic',
          id: 'basic',
          totalBookmarks: 0,
          totalFolders: 0,
          totalDomains: 0,
          lastUpdated: Date.now(),
          dataVersion: DB_CONFIG.VERSION
        })
      )
    })
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    const [bookmarkCount, faviconCount, searchHistoryCount, settingsCount] = await Promise.all([
      this.getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
      this.getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
      this.getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
      this.getStoreCount(DB_CONFIG.STORES.SETTINGS)
    ])

    const totalSize =
      bookmarkCount * 1000 + faviconCount * 2000 + searchHistoryCount * 100 + settingsCount * 50

    return {
      bookmarkCount,
      faviconCount,
      searchHistoryCount,
      settingsCount,
      totalSize,
      indexSize: Math.round(totalSize * 0.1),
      lastOptimized: Date.now()
    }
  }

  async checkDatabaseHealth(): Promise<DatabaseHealth> {
    try {
      await this.ensureReady()
      const db = this.db!
      const expectedStores = this.storeNames
      const existingStores = Array.from(db.objectStoreNames)

      const missingStores = expectedStores.filter(store => !existingStores.includes(store))
      const extraStores = existingStores.filter(
        store =>
          !expectedStores.includes(
            store as (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES]
          )
      )

      return {
        isHealthy: missingStores.length === 0 && extraStores.length === 0,
        expectedStores,
        existingStores,
        missingStores,
        extraStores,
        lastCheck: Date.now(),
        errors: []
      }
    } catch (error) {
      return {
        isHealthy: false,
        expectedStores: this.storeNames,
        existingStores: [],
        missingStores: this.storeNames,
        extraStores: [],
        lastCheck: Date.now(),
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  async saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string
  ): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.SETTINGS, async (_tx, store) => {
      const record: AppSettings = {
        key,
        value,
        type: (type || typeof value) as AppSettings['type'],
        ...(description !== undefined ? { description } : {}),
        updatedAt: Date.now()
      }

      await this.wrapRequest(store.put(record))
    })
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.SETTINGS,
      async (_tx, store) => await this.wrapRequest(store.get(key))
    )

    return result ? ((result.value as T) ?? null) : null
  }

  async deleteSetting(key: string): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.SETTINGS, async (_tx, store) => {
      await this.wrapRequest(store.delete(key))
    })
  }

  async addSearchHistory(
    query: string,
    results: number,
    executionTime?: number,
    source?: SearchHistoryRecord['source']
  ): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.SEARCH_HISTORY, async (_tx, store) => {
      const record: Omit<SearchHistoryRecord, 'id'> = {
        query,
        results,
        executionTime: executionTime ?? 0,
        source: source ?? 'management',
        timestamp: Date.now()
      }

      await this.wrapRequest(store.add(record))
    })
  }

  async getSearchHistory(limit?: number): Promise<SearchHistoryRecord[]> {
    const cappedLimit = Math.max(0, limit ?? 20)

    return await this.runReadTransaction(
      DB_CONFIG.STORES.SEARCH_HISTORY,
      async (_tx, store) =>
        await new Promise<SearchHistoryRecord[]>((resolve, reject) => {
          const index = store.index('timestamp')
          const results: SearchHistoryRecord[] = []
          const request = index.openCursor(undefined, 'prev')

          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor || results.length >= cappedLimit) {
              resolve(results)
              return
            }

            results.push(cursor.value as SearchHistoryRecord)
            cursor.continue()
          }

          request.onerror = () => {
            reject(request.error ?? new Error('读取筛选历史失败'))
          }
        })
    )
  }

  async clearSearchHistory(): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.SEARCH_HISTORY, async (_tx, store) => {
      await this.wrapRequest(store.clear())
    })
  }

  async saveFaviconCache(record: FaviconCacheRecord): Promise<void> {
    await this.runWriteTransaction(DB_CONFIG.STORES.FAVICON_CACHE, async (_tx, store) => {
      const now = Date.now()
      await this.wrapRequest(
        store.put({
          ...record,
          timestamp: record.timestamp ?? now,
          lastAccessed: record.lastAccessed ?? now,
          updatedAt: record.updatedAt ?? now
        })
      )
    })
  }

  async getFaviconCache(domain: string): Promise<FaviconCacheRecord | null> {
    const result = await this.runReadTransaction(
      DB_CONFIG.STORES.FAVICON_CACHE,
      async (_tx, store) => await this.wrapRequest(store.get(domain))
    )

    return (result ?? null) as FaviconCacheRecord | null
  }

  private async getStoreCount(
    storeName: (typeof DB_CONFIG.STORES)[keyof typeof DB_CONFIG.STORES]
  ): Promise<number> {
    return await this.runReadTransaction(storeName, async (_tx, store) => {
      const request = store.count()
      return await this.wrapRequest(request)
    })
  }

  /**
   * 通过布尔索引统计数量（高性能）
   *
   * @description
   * 利用 IndexedDB 索引快速统计符合条件的记录数量，
   * 无需加载数据到内存，性能极佳。
   *
   * @param indexName - 索引名称（如 'isDuplicate', 'isInvalid'）
   * @param value - 布尔值（true 或 false）
   * @returns 符合条件的记录数量
   *
   * @example
   * ```typescript
   * // 统计重复书签数量
   * const count = await indexedDBManager.countByBooleanIndex('isDuplicate', true)
   *
   * // 统计无效书签数量
   * const count = await indexedDBManager.countByBooleanIndex('isInvalid', true)
   * ```
   */
  async countByBooleanIndex(indexName: string, value: boolean): Promise<number> {
    return await this.runReadTransaction(DB_CONFIG.STORES.BOOKMARKS, async (_tx, store) => {
      try {
        // ✅ 先检查索引是否存在
        if (!store.indexNames.contains(indexName)) {
          // 索引还未创建（数据库正在初始化中），这是正常情况，返回 0
          logger.debug('IndexedDBManager', `索引 ${indexName} 暂不可用（数据库初始化中），返回 0`)
          return 0
        }

        const index = store.index(indexName)
        const request = index.count(IDBKeyRange.only(value))
        return await this.wrapRequest(request)
      } catch (error) {
        logger.debug('IndexedDBManager', `通过索引 ${indexName} 统计失败，返回 0`, {
          error,
          indexName,
          value
        })
        return 0
      }
    })
  }

  /**
   * 导出所有对象存储的完整数据，仅供开发/调试使用。
   */
  async exportAllStores(): Promise<StoreDump> {
    const snapshot = {} as StoreDump
    for (const storeName of this.storeNames) {
      snapshot[storeName] = await this.runReadTransaction(storeName, async (_tx, store) => {
        const records = await this.wrapRequest(store.getAll())
        return Array.isArray(records) ? records.map(record => cloneValue(record)) : []
      })
    }
    return snapshot
  }

  /**
   * 将提供的数据写回所有对象存储（会清空后再写入）。
   * 仅供开发/调试环境恢复快照。
   */
  async importAllStores(dump: Partial<StoreDump> | null | undefined): Promise<{
    restoredStores: number
    restoredRecords: number
  }> {
    if (!dump) {
      return { restoredStores: 0, restoredRecords: 0 }
    }

    let restoredStores = 0
    let restoredRecords = 0

    for (const storeName of this.storeNames) {
      const rawRecords = dump[storeName]
      const records = Array.isArray(rawRecords) ? rawRecords : []
      await this.runWriteTransaction(storeName, async (_tx, store) => {
        await this.wrapRequest(store.clear())
        for (const record of records) {
          await this.wrapRequest(store.put(cloneValue(record)))
          restoredRecords++
        }
      })
      restoredStores++
    }

    return { restoredStores, restoredRecords }
  }

  /**
   * 构建搜索索引列表
   */
  private buildSearchIndexes(normalized: SearchOptions, store: IDBObjectStore): string[] {
    const indexes: string[] = ['titleLower']
    if (normalized.includeDomain && store.indexNames.contains('domain')) {
      indexes.push('domain')
    }
    if (normalized.includeUrl && store.indexNames.contains('urlLower')) {
      indexes.push('urlLower')
    }
    if (normalized.includeKeywords && store.indexNames.contains('keywords')) {
      indexes.push('keywords')
    }
    if (normalized.includeTags && store.indexNames.contains('tags')) {
      indexes.push('tags')
    }
    return indexes
  }

  /**
   * 收集候选书签
   */
  private async collectCandidateBookmarks(
    store: IDBObjectStore,
    indexes: string[],
    terms: string[],
    limit: number
  ): Promise<Map<string, BookmarkRecord>> {
    const candidateMap = new Map<string, BookmarkRecord>()
    const perIndexCap = Math.max(200, limit * 3)

    for (const term of terms) {
      for (const indexName of indexes) {
        const index = store.index(indexName)
        const range =
          indexName === 'keywords' || indexName === 'tags'
            ? IDBKeyRange.only(term)
            : IDBKeyRange.bound(term, `${term}\uffff`)

        await new Promise<void>((resolve, reject) => {
          let collected = 0
          const request = index.openCursor(range)
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor || collected >= perIndexCap) {
              resolve()
              return
            }

            const parsed = BookmarkRecordSchema.safeParse(cursor.value)
            if (!parsed.success) {
              reject(parsed.error)
              return
            }

            candidateMap.set(parsed.data.id, {
              ...parsed.data,
              traitTags: parsed.data.traitTags ?? [],
              traitMetadata: (parsed.data.traitMetadata ?? []) as TraitMetadata[]
            } as BookmarkRecord)
            collected++
            cursor.continue()
          }

          request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB 游标遍历失败'))
          }
        })
      }
    }

    return candidateMap
  }

  /**
   * 对候选书签进行评分和过滤
   */
  private scoreAndFilterCandidates(
    candidateMap: Map<string, BookmarkRecord>,
    terms: string[],
    normalized: SearchOptions
  ): SearchResult[] {
    const scored: SearchResult[] = []
    for (const record of candidateMap.values()) {
      const normalizedRecord: BookmarkRecord = {
        ...record,
        traitTags: record.traitTags ?? [],
        traitMetadata: (record.traitMetadata ?? []) as TraitMetadata[]
      } as BookmarkRecord
      const score = this.calculateSearchScore(normalizedRecord, terms, normalized)
      if (score <= (normalized.minScore ?? 0)) continue

      scored.push({
        id: record.id,
        score,
        bookmark: normalizedRecord
      })
    }
    return scored
  }

  /**
   * 排序搜索结果
   */
  private sortSearchResults(scored: SearchResult[], sortBy?: string): SearchResult[] {
    if (sortBy === 'title') {
      scored.sort((a, b) => (a.bookmark.title as string).localeCompare(b.bookmark.title as string))
    } else if (sortBy === 'dateAdded') {
      scored.sort((a, b) => (b.bookmark.dateAdded ?? 0) - (a.bookmark.dateAdded ?? 0))
    } else if (sortBy === 'visitCount') {
      scored.sort((a, b) => (b.bookmark.visitCount ?? 0) - (a.bookmark.visitCount ?? 0))
    } else {
      scored.sort((a, b) => b.score - a.score)
    }
    return scored
  }

  /**
   * 限制搜索结果数量
   */
  private limitSearchResults(scored: SearchResult[], limit: number | undefined): SearchResult[] {
    return limit && limit > 0 ? scored.slice(0, limit) : scored
  }
}

export const indexedDBManager = new IndexedDBManager()

// 导出性能监控器，供外部使用
export { performanceMonitor } from './performance-monitor'
