/**
 * `memory_notes` 读写：按源查、按 owner 扫、写命题、扫孤儿、标脏。
 * 只写派生表，永不改 `memory_items`。
 */

import {
  DREAMING_MAX_PROPOSITIONS_PER_SOURCE,
  DREAMING_PROPOSITION_MAX_CHARS,
  DREAMING_SCHEMA_VERSION
} from '@/core/dreaming/dreaming-constants'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
import {
  MEMORY_NOTES_INDEX_BY_OWNER_SOURCE,
  MEMORY_NOTES_INDEX_BY_OWNER_UPDATED,
  MEMORY_NOTES_STORE
} from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import {
  buildMemoryNoteId,
  hasMemoryNoteSourceCitation,
  MemoryNoteRecordSchema,
  type MemoryNoteRecord
} from '@/infrastructure/indexeddb/memory-notes-types'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

function parseNote(raw: unknown): MemoryNoteRecord | null {
  const parsed = MemoryNoteRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** 写入前校验后的命题输入（尚未分配 id / 时间戳）。 */
export type MemoryNoteWriteInput = {
  ownerId: string
  sourceMemoryItemId: string
  sourceType: SupportedMemoryItemType
  text: string
  sourceQuote: string
  sourceSpan?: { start: number; end: number }
  topicAnchor?: string[]
  embedding?: number[]
  embeddingModel?: string
  embeddingDim?: number
  dreamRunId: string
  version?: number
  sourceUpdatedAt: string
  propositionIndex: number
}

export class MemoryNotesRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  /** 按主键读一条命题。 */
  async getById(id: string): Promise<MemoryNoteRecord | null> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readonly', async transaction => {
      const raw = await requestToPromise(transaction.objectStore(MEMORY_NOTES_STORE).get(id))
      return parseNote(raw)
    })
  }

  /** 某源条目下全部命题（按 propositionIndex 序，即 id 序）。 */
  async listBySource(input: {
    ownerId: string
    sourceMemoryItemId: string
  }): Promise<MemoryNoteRecord[]> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readonly', async transaction => {
      const index = transaction
        .objectStore(MEMORY_NOTES_STORE)
        .index(MEMORY_NOTES_INDEX_BY_OWNER_SOURCE)
      const key = IDBKeyRange.only([input.ownerId, input.sourceMemoryItemId])
      const rawList = await requestToPromise(index.getAll(key))
      const notes = (Array.isArray(rawList) ? rawList : [])
        .map(parseNote)
        .filter((note): note is MemoryNoteRecord => note != null)
      notes.sort((left, right) => left.id.localeCompare(right.id))
      return notes
    })
  }

  /**
   * 按 owner + updatedAt 增量扫命题。
   * `afterUpdatedAt` 严格大于；缺省则全量（仍受 limit 截断）。
   */
  async listByOwnerUpdated(input: {
    ownerId: string
    afterUpdatedAt?: string
    limit: number
  }): Promise<MemoryNoteRecord[]> {
    await this.ensureReady()
    const limit = Math.max(0, input.limit)
    if (limit === 0) {
      return []
    }
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readonly', async transaction => {
      const index = transaction
        .objectStore(MEMORY_NOTES_STORE)
        .index(MEMORY_NOTES_INDEX_BY_OWNER_UPDATED)
      const range =
        input.afterUpdatedAt != null
          ? IDBKeyRange.bound(
              [input.ownerId, input.afterUpdatedAt],
              [input.ownerId, '\uffff'],
              true,
              false
            )
          : IDBKeyRange.bound([input.ownerId, ''], [input.ownerId, '\uffff'])
      const rawList = await requestToPromise(index.getAll(range, limit))
      return (Array.isArray(rawList) ? rawList : [])
        .map(parseNote)
        .filter((note): note is MemoryNoteRecord => note != null)
    })
  }

  /**
   * 写入一条命题。无引用 / 超长 / 序号越界 → 拒绝并打日志，不入库。
   * @returns 写入成功的行；拒绝时 null
   */
  async putProposition(
    input: MemoryNoteWriteInput,
    nowMs: number = Date.now()
  ): Promise<MemoryNoteRecord | null> {
    await this.ensureReady()

    const text = input.text.trim()
    if (!text) {
      logger.warn('Dreaming', '命题正文为空，丢弃', {
        sourceMemoryItemId: input.sourceMemoryItemId
      })
      return null
    }
    if (text.length > DREAMING_PROPOSITION_MAX_CHARS) {
      logger.warn('Dreaming', '命题超长，丢弃', {
        sourceMemoryItemId: input.sourceMemoryItemId,
        length: text.length,
        max: DREAMING_PROPOSITION_MAX_CHARS
      })
      return null
    }
    if (
      input.propositionIndex < 0 ||
      input.propositionIndex >= DREAMING_MAX_PROPOSITIONS_PER_SOURCE
    ) {
      logger.warn('Dreaming', '命题序号越界，丢弃', {
        sourceMemoryItemId: input.sourceMemoryItemId,
        propositionIndex: input.propositionIndex
      })
      return null
    }
    if (
      !hasMemoryNoteSourceCitation({
        sourceQuote: input.sourceQuote,
        ...(input.sourceSpan != null ? { sourceSpan: input.sourceSpan } : {})
      })
    ) {
      logger.warn('Dreaming', '命题无引用，丢弃', {
        sourceMemoryItemId: input.sourceMemoryItemId,
        dreamRunId: input.dreamRunId
      })
      return null
    }

    const nowIso = new Date(nowMs).toISOString()
    const record: MemoryNoteRecord = {
      id: buildMemoryNoteId(input.ownerId, input.sourceMemoryItemId, input.propositionIndex),
      ownerId: input.ownerId,
      sourceMemoryItemId: input.sourceMemoryItemId,
      sourceType: input.sourceType,
      text,
      sourceQuote: input.sourceQuote.trim(),
      ...(input.sourceSpan ? { sourceSpan: input.sourceSpan } : {}),
      topicAnchor: input.topicAnchor ?? [],
      ...(input.embedding ? { embedding: input.embedding } : {}),
      ...(input.embeddingModel ? { embeddingModel: input.embeddingModel } : {}),
      ...(input.embeddingDim != null ? { embeddingDim: input.embeddingDim } : {}),
      dreamRunId: input.dreamRunId,
      version: input.version ?? 1,
      schemaVersion: DREAMING_SCHEMA_VERSION,
      sourceUpdatedAt: input.sourceUpdatedAt,
      createdAt: nowIso,
      updatedAt: nowIso
    }

    const parsed = MemoryNoteRecordSchema.safeParse(record)
    if (!parsed.success) {
      logger.warn('Dreaming', '命题 schema 校验失败，丢弃', {
        sourceMemoryItemId: input.sourceMemoryItemId,
        issues: parsed.error.issues.slice(0, 3)
      })
      return null
    }

    await indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readwrite', async transaction => {
      await requestToPromise(transaction.objectStore(MEMORY_NOTES_STORE).put(parsed.data))
    })

    logger.info('Dreaming', '命题已写入', {
      id: parsed.data.id,
      sourceMemoryItemId: input.sourceMemoryItemId,
      dreamRunId: input.dreamRunId
    })
    return parsed.data
  }

  /** 删除某源下全部命题（源硬删 / 重算前清槽）。 */
  async deleteBySource(input: { ownerId: string; sourceMemoryItemId: string }): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_NOTES_STORE)
      const index = store.index(MEMORY_NOTES_INDEX_BY_OWNER_SOURCE)
      const key = IDBKeyRange.only([input.ownerId, input.sourceMemoryItemId])
      const rawList = await requestToPromise(index.getAllKeys(key))
      const keys = Array.isArray(rawList) ? rawList : []
      for (const id of keys) {
        await requestToPromise(store.delete(id))
      }
      return keys.length
    })
  }

  /**
   * 扫孤儿：命题的 sourceMemoryItemId 不在 `existingSourceIds` 内则删除。
   * @returns 删除条数
   */
  async sweepOrphans(input: {
    ownerId: string
    existingSourceIds: ReadonlySet<string>
  }): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_NOTES_STORE)
      const index = store.index(MEMORY_NOTES_INDEX_BY_OWNER_UPDATED)
      const range = IDBKeyRange.bound([input.ownerId, ''], [input.ownerId, '\uffff'])
      const rawList = await requestToPromise(index.getAll(range))
      let deleted = 0
      for (const raw of Array.isArray(rawList) ? rawList : []) {
        const note = parseNote(raw)
        if (note == null) {
          continue
        }
        if (input.existingSourceIds.has(note.sourceMemoryItemId)) {
          continue
        }
        await requestToPromise(store.delete(note.id))
        deleted += 1
      }
      if (deleted > 0) {
        logger.info('Dreaming', '孤儿命题已清理', {
          ownerId: input.ownerId,
          deleted
        })
      }
      return deleted
    })
  }

  /** 按 owner 统计命题条数。 */
  async countByOwner(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readonly', async transaction => {
      const index = transaction
        .objectStore(MEMORY_NOTES_STORE)
        .index(MEMORY_NOTES_INDEX_BY_OWNER_UPDATED)
      const range = IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff'])
      const count = await requestToPromise(index.count(range))
      return typeof count === 'number' ? count : 0
    })
  }

  /**
   * 硬清某 owner 全部命题（`CLEAR_LOCAL_MEMORY` / `replaceOwnerItems` 连带）。
   * `CLEAR_LOCAL_RECALL_ADAPTATION` 不得调用本方法。
   */
  async clearOwnerNotes(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(MEMORY_NOTES_STORE, 'readwrite', async transaction => {
      const store = transaction.objectStore(MEMORY_NOTES_STORE)
      const index = store.index(MEMORY_NOTES_INDEX_BY_OWNER_UPDATED)
      const range = IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff'])
      const keys = await requestToPromise(index.getAllKeys(range))
      const list = Array.isArray(keys) ? keys : []
      for (const id of list) {
        await requestToPromise(store.delete(id))
      }
      if (list.length > 0) {
        logger.info('Dreaming', '已清除 owner 全部命题', {
          ownerId,
          deleted: list.length
        })
      }
      return list.length
    })
  }
}

export const memoryNotesRepository = new MemoryNotesRepository()
