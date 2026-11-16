/**
 * `memory_note_embeddings`：命题向量可重算缓存（不进 Backup；恢复后重建）。
 */

import {
  MEMORY_NOTE_EMBEDDING_INDEX_BY_OWNER,
  MEMORY_NOTE_EMBEDDING_STORE
} from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import {
  MemoryNoteEmbeddingRecordSchema,
  toLoadedNoteEmbedding,
  type MemoryNoteEmbeddingLoaded,
  type MemoryNoteEmbeddingRecord
} from '@/infrastructure/indexeddb/memory-note-embedding-types'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

function parseRecord(raw: unknown): MemoryNoteEmbeddingRecord | null {
  const parsed = MemoryNoteEmbeddingRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class MemoryNoteEmbeddingRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  async getById(id: string): Promise<MemoryNoteEmbeddingLoaded | null> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_NOTE_EMBEDDING_STORE,
      'readonly',
      async transaction => {
        const raw = await requestToPromise(
          transaction.objectStore(MEMORY_NOTE_EMBEDDING_STORE).get(id)
        )
        const parsed = parseRecord(raw)
        return parsed ? toLoadedNoteEmbedding(parsed) : null
      }
    )
  }

  /** 按 note id 批量读（语义匹配扫表）。 */
  async getManyByIds(ids: readonly string[]): Promise<Map<string, MemoryNoteEmbeddingLoaded>> {
    await this.ensureReady()
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) {
      return new Map()
    }
    return indexedDBManager.withTransaction(
      MEMORY_NOTE_EMBEDDING_STORE,
      'readonly',
      async transaction => {
        const store = transaction.objectStore(MEMORY_NOTE_EMBEDDING_STORE)
        const out = new Map<string, MemoryNoteEmbeddingLoaded>()
        for (const id of unique) {
          const raw = await requestToPromise(store.get(id))
          const parsed = parseRecord(raw)
          if (parsed) {
            out.set(id, toLoadedNoteEmbedding(parsed))
          }
        }
        return out
      }
    )
  }

  /** 某源下全部向量（重算复用前快照）。 */
  async listBySource(input: {
    ownerId: string
    sourceMemoryItemId: string
  }): Promise<MemoryNoteEmbeddingLoaded[]> {
    const all = await this.listByOwner(input.ownerId)
    return all.filter(row => row.sourceMemoryItemId === input.sourceMemoryItemId)
  }

  async listByOwner(ownerId: string, limit?: number): Promise<MemoryNoteEmbeddingLoaded[]> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_NOTE_EMBEDDING_STORE,
      'readonly',
      async transaction => {
        const index = transaction
          .objectStore(MEMORY_NOTE_EMBEDDING_STORE)
          .index(MEMORY_NOTE_EMBEDDING_INDEX_BY_OWNER)
        const rawList = await requestToPromise(
          limit != null && limit > 0 ? index.getAll(ownerId, limit) : index.getAll(ownerId)
        )
        return (Array.isArray(rawList) ? rawList : [])
          .map(parseRecord)
          .filter((row): row is MemoryNoteEmbeddingRecord => row != null)
          .map(toLoadedNoteEmbedding)
      }
    )
  }

  async putRecord(record: MemoryNoteEmbeddingRecord): Promise<MemoryNoteEmbeddingRecord | null> {
    await this.ensureReady()
    const parsed = MemoryNoteEmbeddingRecordSchema.safeParse(record)
    if (!parsed.success) {
      logger.warn('Dreaming', '命题向量 schema 校验失败，丢弃', {
        id: record.id,
        issues: parsed.error.issues.slice(0, 3)
      })
      return null
    }
    await indexedDBManager.withTransaction(
      MEMORY_NOTE_EMBEDDING_STORE,
      'readwrite',
      async transaction => {
        await requestToPromise(
          transaction.objectStore(MEMORY_NOTE_EMBEDDING_STORE).put(parsed.data)
        )
      }
    )
    return parsed.data
  }

  async deleteByIds(ids: readonly string[]): Promise<number> {
    await this.ensureReady()
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) {
      return 0
    }
    return indexedDBManager.withTransaction(
      MEMORY_NOTE_EMBEDDING_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(MEMORY_NOTE_EMBEDDING_STORE)
        let deleted = 0
        for (const id of unique) {
          await requestToPromise(store.delete(id))
          deleted += 1
        }
        return deleted
      }
    )
  }

  async deleteBySource(input: { ownerId: string; sourceMemoryItemId: string }): Promise<number> {
    const rows = await this.listBySource(input)
    return this.deleteByIds(rows.map(row => row.id))
  }

  /** `CLEAR_LOCAL_MEMORY` / replaceOwnerItems 连带清。 */
  async clearOwner(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_NOTE_EMBEDDING_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(MEMORY_NOTE_EMBEDDING_STORE)
        const index = store.index(MEMORY_NOTE_EMBEDDING_INDEX_BY_OWNER)
        const keys = await requestToPromise(index.getAllKeys(ownerId))
        const list = Array.isArray(keys) ? keys : []
        for (const id of list) {
          await requestToPromise(store.delete(id))
        }
        if (list.length > 0) {
          logger.info('Dreaming', '已清除 owner 全部命题向量', {
            ownerId,
            deleted: list.length
          })
        }
        return list.length
      }
    )
  }
}

export const memoryNoteEmbeddingRepository = new MemoryNoteEmbeddingRepository()
