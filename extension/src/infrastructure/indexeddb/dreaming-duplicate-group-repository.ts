/**
 * dreaming_duplicate_groups：同一折叠键下多源 MemoryItem 链接（只标不删）。
 */

import { z } from 'zod'

import type { DreamingDuplicateGroupLink } from '@/core/dreaming/capture-dreaming-preprocess'
import { DREAMING_DUPLICATE_GROUP_STORE } from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

export const DreamingDuplicateGroupRecordSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().uuid(),
  foldKey: z.string().min(1),
  enrichmentReuseKey: z.string().nullable(),
  embedReuseKey: z.string().nullable(),
  /** 同组源条目 id（允许多条并存；不合并计数）。 */
  sourceMemoryItemIds: z.array(z.string().uuid()),
  updatedAt: z.string().datetime()
})

export type DreamingDuplicateGroupRecord = z.infer<typeof DreamingDuplicateGroupRecordSchema>

function parseGroup(raw: unknown): DreamingDuplicateGroupRecord | null {
  const parsed = DreamingDuplicateGroupRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class DreamingDuplicateGroupRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  async getById(id: string): Promise<DreamingDuplicateGroupRecord | null> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      DREAMING_DUPLICATE_GROUP_STORE,
      'readonly',
      async transaction => {
        const raw = await requestToPromise(
          transaction.objectStore(DREAMING_DUPLICATE_GROUP_STORE).get(id)
        )
        return parseGroup(raw)
      }
    )
  }

  /**
   * 把一条 Capture 预处理链接并入组：同 foldKey 追加 source id，不删旧行、不合并计数。
   */
  async upsertLink(
    link: DreamingDuplicateGroupLink,
    nowMs: number = Date.now()
  ): Promise<DreamingDuplicateGroupRecord> {
    await this.ensureReady()
    const nowIso = new Date(nowMs).toISOString()

    return indexedDBManager.withTransaction(
      DREAMING_DUPLICATE_GROUP_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(DREAMING_DUPLICATE_GROUP_STORE)
        const existing = parseGroup(await requestToPromise(store.get(link.id)))
        const memberIds = existing?.sourceMemoryItemIds ?? []
        const nextIds = memberIds.includes(link.sourceMemoryItemId)
          ? memberIds
          : [...memberIds, link.sourceMemoryItemId]

        const record: DreamingDuplicateGroupRecord = {
          id: link.id,
          ownerId: link.ownerId,
          foldKey: link.foldKey,
          enrichmentReuseKey: link.enrichmentReuseKey,
          embedReuseKey: link.embedReuseKey,
          sourceMemoryItemIds: nextIds,
          updatedAt: nowIso
        }
        const parsed = DreamingDuplicateGroupRecordSchema.parse(record)
        await requestToPromise(store.put(parsed))
        logger.info('Dreaming', 'duplicate-group 已更新', {
          foldKey: link.foldKey,
          members: parsed.sourceMemoryItemIds.length,
          sourceMemoryItemId: link.sourceMemoryItemId
        })
        return parsed
      }
    )
  }

  /** `CLEAR_LOCAL_MEMORY` / replaceOwnerItems 连带清。 */
  async clearOwnerGroups(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      DREAMING_DUPLICATE_GROUP_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(DREAMING_DUPLICATE_GROUP_STORE)
        const all = await requestToPromise(store.getAll())
        let deleted = 0
        for (const raw of Array.isArray(all) ? all : []) {
          const group = parseGroup(raw)
          if (group == null || group.ownerId !== ownerId) {
            continue
          }
          await requestToPromise(store.delete(group.id))
          deleted += 1
        }
        if (deleted > 0) {
          logger.info('Dreaming', '已清除 owner duplicate-groups', { ownerId, deleted })
        }
        return deleted
      }
    )
  }
}

export const dreamingDuplicateGroupRepository = new DreamingDuplicateGroupRepository()
