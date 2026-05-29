/**
 * 本地向量存储
 *
 * 将书签的 embedding 向量存储在 IndexedDB 的 EMBEDDINGS store 中，
 * 并提供余弦相似度查询（纯本地计算，无网络请求）。
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { DB_CONFIG } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'LocalVectorStore'

export interface VectorRecord {
  /** 主键，与书签 ID 一致 */
  bookmarkId: string
  /** embedding 向量 */
  vector: number[]
  /** 生成向量时使用的模型名称 */
  model: string
  /** 书签标题（冗余存储，避免查询时回表） */
  title: string
  /** 书签 URL */
  url: string
  /** 创建/更新时间 */
  updatedAt: number
}

export interface VectorSearchResult {
  bookmarkId: string
  score: number
  title: string
  url: string
}

export class LocalVectorStore {
  /**
   * 写入或更新单条向量记录
   */
  async upsert(record: VectorRecord): Promise<void> {
    await indexedDBManager.withTransaction([DB_CONFIG.STORES.EMBEDDINGS], 'readwrite', async tx => {
      const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
      await new Promise<void>((resolve, reject) => {
        const req = store.put(record)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    })
  }

  /**
   * 批量写入向量记录
   */
  async upsertBatch(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return

    await indexedDBManager.withTransaction([DB_CONFIG.STORES.EMBEDDINGS], 'readwrite', async tx => {
      const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
      await Promise.all(
        records.map(
          record =>
            new Promise<void>((resolve, reject) => {
              const req = store.put(record)
              req.onsuccess = () => resolve()
              req.onerror = () => reject(req.error)
            })
        )
      )
    })
  }

  /**
   * 删除指定书签的向量记录
   */
  async delete(bookmarkId: string): Promise<void> {
    await indexedDBManager.withTransaction([DB_CONFIG.STORES.EMBEDDINGS], 'readwrite', async tx => {
      const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(bookmarkId)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    })
  }

  /**
   * 批量删除
   */
  async deleteBatch(bookmarkIds: string[]): Promise<void> {
    if (bookmarkIds.length === 0) return

    await indexedDBManager.withTransaction([DB_CONFIG.STORES.EMBEDDINGS], 'readwrite', async tx => {
      const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
      await Promise.all(
        bookmarkIds.map(
          id =>
            new Promise<void>((resolve, reject) => {
              const req = store.delete(id)
              req.onsuccess = () => resolve()
              req.onerror = () => reject(req.error)
            })
        )
      )
    })
  }

  /**
   * 获取所有向量记录（用于相似度计算）
   */
  async getAll(): Promise<VectorRecord[]> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.EMBEDDINGS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        return new Promise<VectorRecord[]>((resolve, reject) => {
          const req = store.getAll()
          req.onsuccess = () => resolve((req.result as VectorRecord[]) ?? [])
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 获取已存储的所有 bookmarkId 集合（用于增量判断）
   */
  async getAllIds(): Promise<Set<string>> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.EMBEDDINGS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        return new Promise<Set<string>>((resolve, reject) => {
          const req = store.getAllKeys()
          req.onsuccess = () => resolve(new Set(req.result as string[]))
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 获取向量总数
   */
  async count(): Promise<number> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.EMBEDDINGS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        return new Promise<number>((resolve, reject) => {
          const req = store.count()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 余弦相似度搜索
   *
   * 加载所有向量到内存，计算与查询向量的余弦相似度，返回 topK 结果。
   * 对于 2 万书签，向量维度 384，内存占用约 30MB，计算耗时 < 50ms。
   *
   * @param queryVector 查询向量（已归一化）
   * @param topK 返回数量
   * @param minScore 最低相似度阈值（0-1），过滤不相关结果，默认 0.2
   */
  async search(queryVector: number[], topK = 10, minScore = 0.2): Promise<VectorSearchResult[]> {
    const allRecords = await this.getAll()

    if (allRecords.length === 0) {
      logger.info(LOG_TAG, '向量库为空，跳过语义搜索')
      return []
    }

    // 计算余弦相似度（向量已归一化，直接点积即可）
    const scored = allRecords
      .map(record => ({
        bookmarkId: record.bookmarkId,
        title: record.title,
        url: record.url,
        score: dotProduct(queryVector, record.vector)
      }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    logger.info(LOG_TAG, `向量搜索完成: ${allRecords.length} 条 → ${scored.length} 条结果`)
    return scored
  }
}

/**
 * 点积（归一化向量的余弦相似度 = 点积）
 */
function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined || right === undefined) return 0
    sum += left * right
  }
  return sum
}

export const localVectorStore = new LocalVectorStore()
