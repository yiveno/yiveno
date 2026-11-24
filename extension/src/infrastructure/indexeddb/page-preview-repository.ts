/**
 * `memory_page_previews`：按 owner+urlKey 存 JPEG；IDB 落盘 ArrayBuffer，API 面 Blob。
 * LRU 淘汰最久未展示。
 */

import { MEMORY_PAGE_PREVIEW_STORE } from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import {
  buildPagePreviewId,
  PAGE_PREVIEW_MAX_BYTES,
  PAGE_PREVIEW_MAX_ENTRIES,
  PagePreviewMetaSchema,
  pickPagePreviewLruVictims,
  type PagePreviewRecord,
  type PagePreviewStoredRow
} from '@/infrastructure/indexeddb/page-preview-types'
import { logger } from '@/infrastructure/logging/logger'

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer
}

/** 识别入参 Blob（写入前）。 */
function isBlob(value: unknown): value is Blob {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as { size?: unknown; type?: unknown; arrayBuffer?: unknown }
  return (
    typeof candidate.size === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.arrayBuffer === 'function'
  )
}

function parseRecord(raw: unknown): PagePreviewRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const row = raw as Record<string, unknown>
  const meta = PagePreviewMetaSchema.safeParse({
    id: row.id,
    ownerId: row.ownerId,
    urlKey: row.urlKey,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    capturedAt: row.capturedAt,
    lastShownAt: row.lastShownAt,
    source: row.source
  })
  if (!meta.success) {
    return null
  }
  if (!isArrayBuffer(row.bytes)) {
    return null
  }
  const mimeType = typeof row.mimeType === 'string' && row.mimeType ? row.mimeType : 'image/jpeg'
  return {
    ...meta.data,
    blob: new Blob([row.bytes], { type: mimeType })
  }
}

async function toStoredRow(record: PagePreviewRecord): Promise<PagePreviewStoredRow> {
  const meta = PagePreviewMetaSchema.parse({
    id: record.id,
    ownerId: record.ownerId,
    urlKey: record.urlKey,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
    capturedAt: record.capturedAt,
    lastShownAt: record.lastShownAt,
    source: record.source
  })
  if (!isBlob(record.blob)) {
    throw new Error('page_preview blob 无效')
  }
  const bytes = await record.blob.arrayBuffer()
  return {
    ...meta,
    bytes,
    mimeType: record.blob.type || 'image/jpeg'
  }
}

export class PagePreviewRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  async getByUrl(ownerId: string, urlKey: string): Promise<PagePreviewRecord | null> {
    await this.ensureReady()
    const id = buildPagePreviewId(ownerId, urlKey)
    return indexedDBManager.withTransaction(
      MEMORY_PAGE_PREVIEW_STORE,
      'readonly',
      async transaction => {
        const raw = await requestToPromise(
          transaction.objectStore(MEMORY_PAGE_PREVIEW_STORE).get(id)
        )
        return parseRecord(raw)
      }
    )
  }

  /** 读取并刷新 lastShownAt（悬停展示时调用）。 */
  async getAndTouchShown(
    ownerId: string,
    urlKey: string,
    shownAt = new Date().toISOString()
  ): Promise<PagePreviewRecord | null> {
    await this.ensureReady()
    const id = buildPagePreviewId(ownerId, urlKey)
    return indexedDBManager.withTransaction(
      MEMORY_PAGE_PREVIEW_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(MEMORY_PAGE_PREVIEW_STORE)
        const raw = await requestToPromise(store.get(id))
        if (!raw || typeof raw !== 'object') {
          return null
        }
        const row = raw as Record<string, unknown>
        if (!isArrayBuffer(row.bytes)) {
          return null
        }
        const meta = PagePreviewMetaSchema.safeParse({
          id: row.id,
          ownerId: row.ownerId,
          urlKey: row.urlKey,
          byteSize: row.byteSize,
          width: row.width,
          height: row.height,
          capturedAt: row.capturedAt,
          lastShownAt: shownAt,
          source: row.source
        })
        if (!meta.success) {
          return null
        }
        const mimeType =
          typeof row.mimeType === 'string' && row.mimeType ? row.mimeType : 'image/jpeg'
        const stored: PagePreviewStoredRow = {
          ...meta.data,
          bytes: row.bytes,
          mimeType
        }
        await requestToPromise(store.put(stored))
        return {
          ...meta.data,
          blob: new Blob([row.bytes], { type: mimeType })
        }
      }
    )
  }

  async listByOwner(ownerId: string): Promise<PagePreviewRecord[]> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_PAGE_PREVIEW_STORE,
      'readonly',
      async transaction => {
        const store = transaction.objectStore(MEMORY_PAGE_PREVIEW_STORE)
        const all = (await requestToPromise(store.getAll())) as unknown[]
        const out: PagePreviewRecord[] = []
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

  /**
   * 写入预览；超条数或超字节时淘汰最久未展示。
   * 返回淘汰条数。
   */
  async putRecord(record: PagePreviewRecord): Promise<{ evicted: number }> {
    await this.ensureReady()
    let toStore: PagePreviewStoredRow
    try {
      toStore = await toStoredRow(record)
    } catch (error) {
      logger.warn('PagePreview', 'page_preview 写入校验失败', {
        urlKey: record.urlKey,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    return indexedDBManager.withTransaction(
      MEMORY_PAGE_PREVIEW_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(MEMORY_PAGE_PREVIEW_STORE)
        await requestToPromise(store.put(toStore))

        // 同事务内用 store.getAll 再按 owner 过滤（避免 fake-indexeddb 索引未即时可见）
        const allRaw = (await requestToPromise(store.getAll())) as unknown[]
        const rows: PagePreviewRecord[] = []
        for (const raw of allRaw) {
          const row = parseRecord(raw)
          if (row != null && row.ownerId === record.ownerId) {
            rows.push(row)
          }
        }

        const victimIds = pickPagePreviewLruVictims(
          rows.map(row => ({
            id: row.id,
            byteSize: row.byteSize,
            lastShownAt: row.lastShownAt,
            capturedAt: row.capturedAt
          })),
          toStore.id,
          { maxEntries: PAGE_PREVIEW_MAX_ENTRIES, maxBytes: PAGE_PREVIEW_MAX_BYTES }
        )
        for (const victimId of victimIds) {
          await requestToPromise(store.delete(victimId))
        }

        return { evicted: victimIds.length }
      }
    )
  }

  /** `CLEAR_LOCAL_MEMORY` / replaceOwnerItems 连带清。 */
  async clearOwner(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      MEMORY_PAGE_PREVIEW_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(MEMORY_PAGE_PREVIEW_STORE)
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

export const pagePreviewRepository = new PagePreviewRepository()
