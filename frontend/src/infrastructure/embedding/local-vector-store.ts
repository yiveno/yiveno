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
   * 读取少量样本记录（用于模型版本探测，避免全量加载）
   */
  async getSample(limit: number): Promise<VectorRecord[]> {
    if (limit <= 0) return []

    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.EMBEDDINGS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        return new Promise<VectorRecord[]>((resolve, reject) => {
          const records: VectorRecord[] = []
          const request = store.openCursor()
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor || records.length >= limit) {
              resolve(records)
              return
            }
            records.push(cursor.value as VectorRecord)
            cursor.continue()
          }
          request.onerror = () => reject(request.error)
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
   * 清空全部向量（模型升级迁移时使用）
   */
  async clearAll(): Promise<void> {
    const allIds = await this.getAllIds()
    if (allIds.size === 0) return
    await this.deleteBatch(Array.from(allIds))
    logger.info(LOG_TAG, `已清空向量库: ${allIds.size} 条`)
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
    const searchStart = performance.now()
    logger.info(LOG_TAG, '▶ 向量相似度搜索开始', {
      topK,
      minScore,
      queryVectorDim: queryVector.length
    })

    const allRecords = await this.getAll()

    if (allRecords.length === 0) {
      logger.info(LOG_TAG, '向量库为空，跳过语义搜索')
      return []
    }

    logger.debug(LOG_TAG, '向量库加载完成', {
      totalVectors: allRecords.length,
      loadDurationMs: Number((performance.now() - searchStart).toFixed(1))
    })

    // 计算余弦相似度（向量已归一化，直接点积即可）
    const scoredAll = allRecords
      .map(record => ({
        bookmarkId: record.bookmarkId,
        title: record.title,
        url: record.url,
        score: dotProduct(queryVector, record.vector)
      }))
      .sort((a, b) => b.score - a.score)

    const topCandidates = scoredAll.slice(0, Math.min(topK, 10))
    const scored = scoredAll.filter(r => r.score >= minScore).slice(0, topK)

    logger.info(LOG_TAG, `向量搜索完成: ${allRecords.length} 条 → ${scored.length} 条结果`, {
      totalVectors: allRecords.length,
      topK,
      minScore,
      acceptedCount: scored.length,
      totalDurationMs: Number((performance.now() - searchStart).toFixed(1)),
      topCandidates: topCandidates.map(candidate => ({
        bookmarkId: candidate.bookmarkId,
        title: candidate.title,
        url: candidate.url,
        score: Number(candidate.score.toFixed(4)),
        accepted: candidate.score >= minScore
      })),
      acceptedResults: scored.map(r => ({
        bookmarkId: r.bookmarkId,
        title: r.title,
        score: Number(r.score.toFixed(4))
      }))
    })
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
