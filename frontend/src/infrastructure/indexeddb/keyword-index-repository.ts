/**
 * 关键词倒排：meta / posting 读写与按 owner 全量重建。
 * 不改变 keyword-filter 打分；仅供候选预过滤。
 */

import {
  extractDocumentIndexTokens,
  pickPostingLookupTokens,
  unionPostingItemIds,
  diffTokenSets
} from '@/core/recall/extract-document-index-tokens'
import { safeParseMemoryItem, type MemoryItem } from '@/core/memory/memory-item'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import {
  KEYWORD_INDEX_CANDIDATE_ID_CAP,
  KEYWORD_INDEX_META_STORE,
  KEYWORD_INDEX_SCHEMA_VERSION,
  KEYWORD_POSTING_STORE,
  MEMORY_ITEM_INDEX_BY_OWNER,
  MEMORY_ITEM_STORE
} from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import {
  buildKeywordPostingId,
  createEmptyKeywordIndexMeta,
  KeywordIndexMetaSchema,
  KeywordPostingRecordSchema,
  type KeywordIndexMeta,
  type KeywordPostingRecord
} from '@/infrastructure/indexeddb/keyword-index-types'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'

function parseMeta(raw: unknown): KeywordIndexMeta | null {
  const parsed = KeywordIndexMetaSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function parsePosting(raw: unknown): KeywordPostingRecord | null {
  const parsed = KeywordPostingRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class KeywordIndexRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  async getMeta(ownerId: string): Promise<KeywordIndexMeta | null> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      KEYWORD_INDEX_META_STORE,
      'readonly',
      async transaction => {
        const raw = await requestToPromise(
          transaction.objectStore(KEYWORD_INDEX_META_STORE).get(ownerId)
        )
        return parseMeta(raw)
      }
    )
  }

  async markDirty(ownerId: string): Promise<void> {
    await this.ensureReady()
    await indexedDBManager.withTransaction(
      KEYWORD_INDEX_META_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(KEYWORD_INDEX_META_STORE)
        const existing = parseMeta(await requestToPromise(store.get(ownerId)))
        const next: KeywordIndexMeta = existing
          ? { ...existing, dirty: true }
          : createEmptyKeywordIndexMeta(ownerId)
        await requestToPromise(store.put(next))
      }
    )
  }

  /** meta 健康：已建过且未 dirty、schema 匹配。 */
  async isHealthy(ownerId: string): Promise<boolean> {
    const meta = await this.getMeta(ownerId)
    return (
      meta != null &&
      !meta.dirty &&
      meta.builtAt != null &&
      meta.schemaVersion === KEYWORD_INDEX_SCHEMA_VERSION
    )
  }

  /**
   * 单条 MemoryItem 的 token 增删增量写入 posting。
   * 仅在索引健康时调用；不健康时请 markDirty，等 Recall rebuild。
   * @returns applied=true 表示已增量；false 表示未动（应改走 dirty）
   */
  async applyItemTokenDiff(input: {
    ownerId: string
    itemId: string
    previousTokens: readonly string[]
    nextTokens: readonly string[]
  }): Promise<{ applied: boolean }> {
    const { ownerId, itemId, previousTokens, nextTokens } = input
    if (!(await this.isHealthy(ownerId))) {
      return { applied: false }
    }

    const { added, removed } = diffTokenSets(previousTokens, nextTokens)
    if (added.length === 0 && removed.length === 0) {
      return { applied: true }
    }

    await this.ensureReady()
    await indexedDBManager.withTransaction(
      [KEYWORD_POSTING_STORE, KEYWORD_INDEX_META_STORE],
      'readwrite',
      async transaction => {
        const postingStore = transaction.objectStore(KEYWORD_POSTING_STORE)

        for (const token of removed) {
          const key = buildKeywordPostingId(ownerId, token)
          const existing = parsePosting(await requestToPromise(postingStore.get(key)))
          if (!existing) {
            continue
          }
          const itemIds = existing.itemIds.filter(id => id !== itemId)
          if (itemIds.length === 0) {
            await requestToPromise(postingStore.delete(key))
          } else {
            await requestToPromise(
              postingStore.put(
                KeywordPostingRecordSchema.parse({
                  ...existing,
                  itemIds
                })
              )
            )
          }
        }

        for (const token of added) {
          const key = buildKeywordPostingId(ownerId, token)
          const existing = parsePosting(await requestToPromise(postingStore.get(key)))
          if (!existing) {
            await requestToPromise(
              postingStore.put(
                KeywordPostingRecordSchema.parse({
                  id: key,
                  ownerId,
                  token,
                  itemIds: [itemId]
                })
              )
            )
            continue
          }
          if (existing.itemIds.includes(itemId)) {
            continue
          }
          await requestToPromise(
            postingStore.put(
              KeywordPostingRecordSchema.parse({
                ...existing,
                itemIds: [...existing.itemIds, itemId]
              })
            )
          )
        }

        // 新建条目：itemCount +1；软删清空 token：itemCount -1（粗略，仅当 prev 空↔next 非空）
        const metaStore = transaction.objectStore(KEYWORD_INDEX_META_STORE)
        const meta = parseMeta(await requestToPromise(metaStore.get(ownerId)))
        if (meta) {
          let itemCount = meta.itemCount
          if (previousTokens.length === 0 && nextTokens.length > 0) {
            itemCount += 1
          } else if (previousTokens.length > 0 && nextTokens.length === 0) {
            itemCount = Math.max(0, itemCount - 1)
          }
          await requestToPromise(
            metaStore.put(
              KeywordIndexMetaSchema.parse({
                ...meta,
                itemCount,
                dirty: false
              })
            )
          )
        }
      }
    )

    return { applied: true }
  }

  /**
   * 清空该 owner 的全部 posting，并写 dirty meta。
   * 用于 replaceOwnerItems 等整桶覆盖。
   */
  async clearOwnerIndex(ownerId: string): Promise<void> {
    await this.ensureReady()
    await indexedDBManager.withTransaction(
      [KEYWORD_POSTING_STORE, KEYWORD_INDEX_META_STORE],
      'readwrite',
      async transaction => {
        const postingStore = transaction.objectStore(KEYWORD_POSTING_STORE)
        const prefix = `${ownerId}\0`
        await new Promise<void>((resolve, reject) => {
          const request = postingStore.openCursor(
            IDBKeyRange.bound(prefix, `${prefix}\uffff`, false, false)
          )
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor) {
              resolve()
              return
            }
            void requestToPromise(cursor.delete())
              .then(() => cursor.continue())
              .catch(reject)
          }
          request.onerror = () => reject(request.error ?? new Error('倒排清理游标失败'))
        })
        await requestToPromise(
          transaction
            .objectStore(KEYWORD_INDEX_META_STORE)
            .put(createEmptyKeywordIndexMeta(ownerId))
        )
      }
    )
  }

  /** 从 memory_items 全量重建该 owner 的 posting。 */
  async rebuildForOwner(ownerId: string): Promise<{ itemCount: number; postingCount: number }> {
    await this.ensureReady()

    const items = await indexedDBManager.withTransaction(
      MEMORY_ITEM_STORE,
      'readonly',
      async transaction => {
        const index = transaction.objectStore(MEMORY_ITEM_STORE).index(MEMORY_ITEM_INDEX_BY_OWNER)
        const range = IDBKeyRange.only(ownerId)
        const collected: MemoryItem[] = []
        await new Promise<void>((resolve, reject) => {
          const request = index.openCursor(range)
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor) {
              resolve()
              return
            }
            const item = safeParseMemoryItem(cursor.value)
            if (item && item.deletedAt == null) {
              collected.push(item)
            }
            cursor.continue()
          }
          request.onerror = () => reject(request.error ?? new Error('重建倒排时读取 Memory 失败'))
        })
        return collected
      }
    )

    const tokenToIds = new Map<string, string[]>()
    for (const item of items) {
      for (const token of extractDocumentIndexTokens(item)) {
        const list = tokenToIds.get(token)
        if (list) {
          list.push(item.id)
        } else {
          tokenToIds.set(token, [item.id])
        }
      }
    }

    await indexedDBManager.withTransaction(
      [KEYWORD_POSTING_STORE, KEYWORD_INDEX_META_STORE],
      'readwrite',
      async transaction => {
        const postingStore = transaction.objectStore(KEYWORD_POSTING_STORE)
        const prefix = `${ownerId}\0`
        await new Promise<void>((resolve, reject) => {
          const request = postingStore.openCursor(
            IDBKeyRange.bound(prefix, `${prefix}\uffff`, false, false)
          )
          request.onsuccess = () => {
            const cursor = request.result
            if (!cursor) {
              resolve()
              return
            }
            void requestToPromise(cursor.delete())
              .then(() => cursor.continue())
              .catch(reject)
          }
          request.onerror = () => reject(request.error ?? new Error('重建前清理 posting 失败'))
        })

        for (const [token, itemIds] of tokenToIds) {
          const record: KeywordPostingRecord = {
            id: buildKeywordPostingId(ownerId, token),
            ownerId,
            token,
            itemIds
          }
          await requestToPromise(postingStore.put(KeywordPostingRecordSchema.parse(record)))
        }

        const meta: KeywordIndexMeta = {
          ownerId,
          schemaVersion: KEYWORD_INDEX_SCHEMA_VERSION,
          builtAt: new Date().toISOString(),
          itemCount: items.length,
          dirty: false
        }
        await requestToPromise(
          transaction.objectStore(KEYWORD_INDEX_META_STORE).put(KeywordIndexMetaSchema.parse(meta))
        )
      }
    )

    return { itemCount: items.length, postingCount: tokenToIds.size }
  }

  /**
   * 若 meta 缺失 / dirty / schema 过期则重建。
   * @returns 是否刚执行了 rebuild
   */
  async ensureReadyForOwner(ownerId: string): Promise<{ rebuilt: boolean }> {
    const meta = await this.getMeta(ownerId)
    const needsRebuild =
      meta == null ||
      meta.dirty ||
      meta.schemaVersion !== KEYWORD_INDEX_SCHEMA_VERSION ||
      meta.builtAt == null

    if (!needsRebuild) {
      return { rebuilt: false }
    }

    await this.rebuildForOwner(ownerId)
    return { rebuilt: true }
  }

  /**
   * 按线索查候选 MemoryItem id（OR 并集）。
   * 无可用查询 token 时返回 null（调用方应 fallback 全表扫）。
   */
  async lookupCandidateIds(
    clue: string,
    ownerId?: string
  ): Promise<{ ids: string[]; rebuilt: boolean } | null> {
    const tokens = pickPostingLookupTokens(clue)
    if (tokens.length === 0) {
      return null
    }

    await this.ensureReady()
    const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())
    const { rebuilt } = await this.ensureReadyForOwner(resolvedOwnerId)

    const lists = await indexedDBManager.withTransaction(
      KEYWORD_POSTING_STORE,
      'readonly',
      async transaction => {
        const store = transaction.objectStore(KEYWORD_POSTING_STORE)
        const result: string[][] = []
        for (const token of tokens) {
          const raw = await requestToPromise(
            store.get(buildKeywordPostingId(resolvedOwnerId, token))
          )
          const posting = parsePosting(raw)
          result.push(posting?.itemIds ?? [])
        }
        return result
      }
    )

    const ids = unionPostingItemIds(lists).slice(0, KEYWORD_INDEX_CANDIDATE_ID_CAP)
    return { ids, rebuilt }
  }
}

export const keywordIndexRepository = new KeywordIndexRepository()
