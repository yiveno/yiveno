/**
 * `memory_link_status`：按源条目存巡检结论（派生；可重算；不进 Backup）。
 */

import { MEMORY_LINK_STATUS_STORE } from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import {
  buildMemoryLinkStatusId,
  MemoryLinkStatusRecordSchema,
  type MemoryLinkStatusRecord
} from '@/infrastructure/indexeddb/memory-link-status-types'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

function parseRecord(raw: unknown): MemoryLinkStatusRecord | null {
  const parsed = MemoryLinkStatusRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class MemoryLinkStatusRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  async getBySource(
    ownerId: string,
    sourceMemoryItemId: string
  ): Promise<MemoryLinkStatusRecord | null> {
    await this.ensureReady()
    const id = buildMemoryLinkStatusId(ownerId, sourceMemoryItemId)
    return indexedDBManager.withTransaction(
      MEMORY_LINK_STATUS_STORE,
      'readonly',
      async transaction => {
        const raw = await requestToPromise(
          transaction.objectStore(MEMORY_LINK_STATUS_STORE).get(id)
        )
        return parseRecord(raw)
      }
    )
  }

  /** 按 owner 批量读（打分侧注入 map）。 */
  async listByOwner(ownerId: string): Promise<MemoryLinkStatusRecord[]> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_LINK_STATUS_STORE,
      'readonly',
      async transaction => {
        const store = transaction.objectStore(MEMORY_LINK_STATUS_STORE)
        const all = (await requestToPromise(store.getAll())) as unknown[]
        const out: MemoryLinkStatusRecord[] = []
        for (const raw of all) {
          const row = parseRecord(raw)
          if (row != null && row.ownerId === ownerId) {
            out.push(row)
          }
        }
        return out
      }
    )
  }

  async putRecord(record: MemoryLinkStatusRecord): Promise<void> {
    await this.ensureReady()
    const parsed = MemoryLinkStatusRecordSchema.safeParse(record)
    if (!parsed.success) {
      logger.warn('Dreaming', 'memory_link_status schema 校验失败', {
        sourceMemoryItemId: record.sourceMemoryItemId,
        issues: parsed.error.issues.slice(0, 3)
      })
      return
    }
    await indexedDBManager.withTransaction(
      MEMORY_LINK_STATUS_STORE,
      'readwrite',
      async transaction => {
        await requestToPromise(transaction.objectStore(MEMORY_LINK_STATUS_STORE).put(parsed.data))
      }
    )
  }

  /** `CLEAR_LOCAL_MEMORY` / replaceOwnerItems 连带清（可重算派生）。 */
  async clearOwner(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_LINK_STATUS_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(MEMORY_LINK_STATUS_STORE)
        const all = (await requestToPromise(store.getAll())) as unknown[]
        let deleted = 0
        for (const raw of all) {
          const row = parseRecord(raw)
          if (row == null || row.ownerId !== ownerId) {
            continue
          }
          await requestToPromise(store.delete(row.id))
          deleted += 1
        }
        return deleted
      }
    )
  }
}

export const memoryLinkStatusRepository = new MemoryLinkStatusRepository()
