/**
 * 文件夹向量存储
 *
 * 职责：
 * 1. 存储和管理文件夹的代表向量
 * 2. 提供向量查询和更新接口
 * 3. 支持批量操作
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { DB_CONFIG, type FolderVectorRecord } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'FolderVectorStore'

export class FolderVectorStore {
  /**
   * 写入或更新单条文件夹向量记录
   */
  async upsert(record: FolderVectorRecord): Promise<void> {
    await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readwrite',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        await new Promise<void>((resolve, reject) => {
          const req = store.put(record)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 批量写入文件夹向量记录
   */
  async upsertBatch(records: FolderVectorRecord[]): Promise<void> {
    if (records.length === 0) return

    await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readwrite',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
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
      }
    )
  }

  /**
   * 获取指定文件夹的向量记录
   */
  async get(folderId: string): Promise<FolderVectorRecord | null> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        return new Promise<FolderVectorRecord | null>((resolve, reject) => {
          const req = store.get(folderId)
          req.onsuccess = () => resolve((req.result as FolderVectorRecord) ?? null)
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 删除指定文件夹的向量记录
   */
  async delete(folderId: string): Promise<void> {
    await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readwrite',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        await new Promise<void>((resolve, reject) => {
          const req = store.delete(folderId)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 批量删除
   */
  async deleteBatch(folderIds: string[]): Promise<void> {
    if (folderIds.length === 0) return

    await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readwrite',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        await Promise.all(
          folderIds.map(
            id =>
              new Promise<void>((resolve, reject) => {
                const req = store.delete(id)
                req.onsuccess = () => resolve()
                req.onerror = () => reject(req.error)
              })
          )
        )
      }
    )
  }

  /**
   * 获取所有文件夹向量记录
   */
  async getAll(): Promise<FolderVectorRecord[]> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        return new Promise<FolderVectorRecord[]>((resolve, reject) => {
          const req = store.getAll()
          req.onsuccess = () => resolve((req.result as FolderVectorRecord[]) ?? [])
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 获取所有文件夹 ID 集合（用于增量判断）
   */
  async getAllIds(): Promise<Set<string>> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        return new Promise<Set<string>>((resolve, reject) => {
          const req = store.getAllKeys()
          req.onsuccess = () => resolve(new Set(req.result as string[]))
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 获取文件夹向量总数
   */
  async count(): Promise<number> {
    return await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readonly',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        return new Promise<number>((resolve, reject) => {
          const req = store.count()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
      }
    )
  }

  /**
   * 清空所有文件夹向量（用于重置）
   */
  async clear(): Promise<void> {
    await indexedDBManager.withTransaction(
      [DB_CONFIG.STORES.FOLDER_VECTORS],
      'readwrite',
      async tx => {
        const store = tx.objectStore(DB_CONFIG.STORES.FOLDER_VECTORS)
        await new Promise<void>((resolve, reject) => {
          const req = store.clear()
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
      }
    )
    logger.info(LOG_TAG, '已清空所有文件夹向量')
  }
}

export const folderVectorStore = new FolderVectorStore()
