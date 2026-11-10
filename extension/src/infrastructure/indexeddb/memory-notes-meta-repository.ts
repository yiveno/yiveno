/**
 * `memory_notes_meta`：每 owner 一条（run 游标 / dirty / schema）。
 */

import { DREAMING_SCHEMA_VERSION } from '@/core/dreaming/dreaming-constants'
import type { DreamRunCursor } from '@/core/dreaming/dream-run-cursor'
import { MEMORY_NOTES_META_STORE } from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import {
  createEmptyMemoryNotesMeta,
  MemoryNotesMetaSchema,
  type MemoryNotesMeta
} from '@/infrastructure/indexeddb/memory-notes-types'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

function parseMeta(raw: unknown): MemoryNotesMeta | null {
  const parsed = MemoryNotesMetaSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class MemoryNotesMetaRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  async getMeta(ownerId: string): Promise<MemoryNotesMeta | null> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_NOTES_META_STORE,
      'readonly',
      async transaction => {
        const raw = await requestToPromise(
          transaction.objectStore(MEMORY_NOTES_META_STORE).get(ownerId)
        )
        return parseMeta(raw)
      }
    )
  }

  /** 读 meta；不存在则建空行。 */
  async getOrCreateMeta(ownerId: string): Promise<MemoryNotesMeta> {
    const existing = await this.getMeta(ownerId)
    if (existing != null) {
      return existing
    }
    const empty = createEmptyMemoryNotesMeta(ownerId)
    await this.putMeta(empty)
    return empty
  }

  async putMeta(meta: MemoryNotesMeta): Promise<void> {
    await this.ensureReady()
    const parsed = MemoryNotesMetaSchema.safeParse(meta)
    if (!parsed.success) {
      logger.warn('Dreaming', 'memory_notes_meta schema 校验失败', {
        ownerId: meta.ownerId,
        issues: parsed.error.issues.slice(0, 3)
      })
      return
    }
    await indexedDBManager.withTransaction(
      MEMORY_NOTES_META_STORE,
      'readwrite',
      async transaction => {
        await requestToPromise(transaction.objectStore(MEMORY_NOTES_META_STORE).put(parsed.data))
      }
    )
  }

  async markDirty(ownerId: string): Promise<void> {
    const existing = await this.getOrCreateMeta(ownerId)
    if (existing.dirty) {
      return
    }
    await this.putMeta({ ...existing, dirty: true })
  }

  /** meta 健康：schema 匹配且未 dirty（builtAt 可空——首次 run 前仍算可续跑）。 */
  async isSchemaCurrent(ownerId: string): Promise<boolean> {
    const meta = await this.getMeta(ownerId)
    return meta != null && meta.schemaVersion === DREAMING_SCHEMA_VERSION
  }

  /** 把游标快照写回 meta（每批提交一次，供中断续跑）。 */
  async commitRunCursor(
    ownerId: string,
    cursor: DreamRunCursor,
    itemCount?: number
  ): Promise<void> {
    const existing = await this.getOrCreateMeta(ownerId)
    await this.putMeta({
      ...existing,
      schemaVersion: DREAMING_SCHEMA_VERSION,
      lastDreamRunId: cursor.dreamRunId,
      lastCursor: cursor.lastCursor,
      lastRunAt: cursor.lastRunAt,
      dirty: false,
      ...(itemCount != null ? { itemCount } : {}),
      builtAt: cursor.lastRunAt ?? existing.builtAt
    })
    logger.info('Dreaming', 'run 游标已提交', {
      ownerId,
      dreamRunId: cursor.dreamRunId,
      lastCursor: cursor.lastCursor || '(empty)'
    })
  }

  /** 从 meta 恢复游标；无 run 记录则返回 null（调用方应 startDreamRun）。 */
  async readRunCursor(ownerId: string): Promise<DreamRunCursor | null> {
    const meta = await this.getOrCreateMeta(ownerId)
    if (meta.lastDreamRunId == null || meta.lastDreamRunId === '') {
      return null
    }
    return {
      dreamRunId: meta.lastDreamRunId,
      lastCursor: meta.lastCursor,
      lastRunAt: meta.lastRunAt
    }
  }

  /**
   * 硬清某 owner 的 dreaming meta（随 `CLEAR_LOCAL_MEMORY`）。
   * `CLEAR_LOCAL_RECALL_ADAPTATION` 不得调用。
   */
  async clearOwnerMeta(ownerId: string): Promise<void> {
    await this.ensureReady()
    await indexedDBManager.withTransaction(
      MEMORY_NOTES_META_STORE,
      'readwrite',
      async transaction => {
        await requestToPromise(transaction.objectStore(MEMORY_NOTES_META_STORE).delete(ownerId))
      }
    )
    logger.info('Dreaming', '已清除 owner dreaming meta', { ownerId })
  }
}

export const memoryNotesMetaRepository = new MemoryNotesMetaRepository()
