/**
 * `portrait_facts` 读写：按 id upsert、按 owner 列举 / 清空。
 * 永不因 decline 删行；clearByOwner 仅清库入口。
 */

import {
  PORTRAIT_FACTS_INDEX_BY_OWNER,
  PORTRAIT_FACTS_STORE
} from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { PortraitFactRecordSchema, type PortraitFactRecord } from '@/core/portrait/portrait-facts'
import { logger } from '@/infrastructure/logging/logger'

function parseRecord(raw: unknown): PortraitFactRecord | null {
  const parsed = PortraitFactRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class PortraitFactsRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  /** 按主键读一条。 */
  async getById(id: string): Promise<PortraitFactRecord | null> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(PORTRAIT_FACTS_STORE, 'readonly', async transaction => {
      const raw = await requestToPromise(transaction.objectStore(PORTRAIT_FACTS_STORE).get(id))
      return parseRecord(raw)
    })
  }

  /** Upsert 单行（覆盖写）。 */
  async put(record: PortraitFactRecord): Promise<PortraitFactRecord> {
    await this.ensureReady()
    const parsed = PortraitFactRecordSchema.parse(record)
    return indexedDBManager.withTransaction(
      PORTRAIT_FACTS_STORE,
      'readwrite',
      async transaction => {
        await requestToPromise(transaction.objectStore(PORTRAIT_FACTS_STORE).put(parsed))
        return parsed
      }
    )
  }

  /** 批量 upsert。 */
  async putMany(records: readonly PortraitFactRecord[]): Promise<number> {
    await this.ensureReady()
    if (records.length === 0) {
      return 0
    }
    return indexedDBManager.withTransaction(
      PORTRAIT_FACTS_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(PORTRAIT_FACTS_STORE)
        let written = 0
        for (const record of records) {
          const parsed = PortraitFactRecordSchema.safeParse(record)
          if (!parsed.success) {
            logger.warn('Portrait', '跳过非法画像行', {
              idPreview: record.id.slice(0, 80)
            })
            continue
          }
          await requestToPromise(store.put(parsed.data))
          written += 1
        }
        return written
      }
    )
  }

  /** 当前 owner 全表。 */
  async listByOwner(ownerId: string): Promise<PortraitFactRecord[]> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(PORTRAIT_FACTS_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(PORTRAIT_FACTS_STORE)
      let rawList: unknown
      if (store.indexNames.contains(PORTRAIT_FACTS_INDEX_BY_OWNER)) {
        rawList = await requestToPromise(store.index(PORTRAIT_FACTS_INDEX_BY_OWNER).getAll(ownerId))
      } else {
        rawList = await requestToPromise(store.getAll())
      }
      return (Array.isArray(rawList) ? rawList : [])
        .map(parseRecord)
        .filter((row): row is PortraitFactRecord => row != null && row.ownerId === ownerId)
    })
  }

  /** 硬清当前 owner（CLEAR_LOCAL_MEMORY）。 */
  async clearByOwner(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      PORTRAIT_FACTS_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(PORTRAIT_FACTS_STORE)
        const rawList = await requestToPromise(store.getAll())
        let deleted = 0
        for (const raw of Array.isArray(rawList) ? rawList : []) {
          const row = parseRecord(raw)
          if (!row || row.ownerId !== ownerId) {
            continue
          }
          await requestToPromise(store.delete(row.id))
          deleted += 1
        }
        logger.info('Portrait', '已清除当前 owner 画像事实', { ownerId, deleted })
        return deleted
      }
    )
  }
}

export const portraitFactsRepository = new PortraitFactsRepository()
