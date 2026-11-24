/**
 * `behavior_stats` 读写：按 owner+url upsert（max 合并）、按 owner 读全表 / 清空。
 * 只写行为事实，永不删行（除显式清除）。
 */

import { BEHAVIOR_STATS_STORE } from '@/infrastructure/indexeddb/constants'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import {
  BehaviorStatsRecordSchema,
  extractBehaviorDomain,
  normalizeBehaviorUrl,
  type BehaviorStatsRecord,
  type BehaviorStatsUpsertInput
} from '@/infrastructure/indexeddb/behavior-stats-types'
import { logger } from '@/infrastructure/logging/logger'

function parseRecord(raw: unknown): BehaviorStatsRecord | null {
  const parsed = BehaviorStatsRecordSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export class BehaviorStatsRepository {
  async ensureReady(): Promise<void> {
    await initializeMemoryDatabase()
  }

  /** 按复合主键读一条。 */
  async getByOwnerUrl(ownerId: string, url: string): Promise<BehaviorStatsRecord | null> {
    await this.ensureReady()
    const normalized = normalizeBehaviorUrl(url)
    if (!normalized) {
      return null
    }
    return indexedDBManager.withTransaction(BEHAVIOR_STATS_STORE, 'readonly', async transaction => {
      const raw = await requestToPromise(
        transaction.objectStore(BEHAVIOR_STATS_STORE).get([ownerId, normalized])
      )
      return parseRecord(raw)
    })
  }

  /**
   * Upsert：重导入按 max(visitCount) / max(lastVisitTime) 合并；计数永不下降。
   * 非法 URL（非 http/https）→ 跳过并返回 null。
   */
  async upsert(input: BehaviorStatsUpsertInput): Promise<BehaviorStatsRecord | null> {
    await this.ensureReady()
    const normalizedUrl = normalizeBehaviorUrl(input.url)
    const domain = normalizedUrl ? extractBehaviorDomain(normalizedUrl) : null
    if (!normalizedUrl || !domain) {
      logger.warn('BehaviorStats', '跳过非法 URL', { urlPreview: input.url.slice(0, 80) })
      return null
    }
    if (!Number.isFinite(input.visitCount) || input.visitCount <= 0) {
      return null
    }
    const nowIso = new Date().toISOString()
    const dwell = input.totalDwellMs ?? 0

    return indexedDBManager.withTransaction(
      BEHAVIOR_STATS_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(BEHAVIOR_STATS_STORE)
        const existingRaw = await requestToPromise(store.get([input.ownerId, normalizedUrl]))
        const existing = parseRecord(existingRaw)

        const visitCount = existing
          ? Math.max(existing.visitCount, Math.floor(input.visitCount))
          : Math.floor(input.visitCount)
        const lastVisitTime = existing
          ? Math.max(existing.lastVisitTime, Math.floor(input.lastVisitTime))
          : Math.floor(input.lastVisitTime)
        const totalDwellMs = existing
          ? Math.max(existing.totalDwellMs, Math.floor(dwell))
          : Math.max(0, Math.floor(dwell))

        const record = BehaviorStatsRecordSchema.parse({
          ownerId: input.ownerId,
          url: normalizedUrl,
          domain,
          visitCount,
          lastVisitTime,
          totalDwellMs,
          updatedAt: nowIso
        })
        await requestToPromise(store.put(record))
        return record
      }
    )
  }

  /** 批量 upsert（同事务外逐条；失败跳过由调用方计数）。 */
  async upsertMany(
    inputs: readonly BehaviorStatsUpsertInput[]
  ): Promise<{ written: number; skipped: number }> {
    let written = 0
    let skipped = 0
    for (const input of inputs) {
      try {
        const row = await this.upsert(input)
        if (row) {
          written += 1
        } else {
          skipped += 1
        }
      } catch (error) {
        skipped += 1
        logger.warn('BehaviorStats', '单条 upsert 失败，已跳过', {
          urlPreview: input.url.slice(0, 80),
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    return { written, skipped }
  }

  /** 当前 owner 全表（无排序保证；调用方自行汇总）。 */
  async listByOwner(ownerId: string): Promise<BehaviorStatsRecord[]> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(BEHAVIOR_STATS_STORE, 'readonly', async transaction => {
      const store = transaction.objectStore(BEHAVIOR_STATS_STORE)
      const rawList = await requestToPromise(store.getAll())
      const rows = (Array.isArray(rawList) ? rawList : [])
        .map(parseRecord)
        .filter((row): row is BehaviorStatsRecord => row != null && row.ownerId === ownerId)
      return rows
    })
  }

  /** 删当前 owner 全部行为行（清除行为数据入口）。 */
  async clearByOwner(ownerId: string): Promise<number> {
    await this.ensureReady()
    return indexedDBManager.withTransaction(
      BEHAVIOR_STATS_STORE,
      'readwrite',
      async transaction => {
        const store = transaction.objectStore(BEHAVIOR_STATS_STORE)
        const rawList = await requestToPromise(store.getAll())
        let deleted = 0
        for (const raw of Array.isArray(rawList) ? rawList : []) {
          const row = parseRecord(raw)
          if (!row || row.ownerId !== ownerId) {
            continue
          }
          await requestToPromise(store.delete([row.ownerId, row.url]))
          deleted += 1
        }
        logger.info('BehaviorStats', '已清除当前 owner 行为数据', { ownerId, deleted })
        return deleted
      }
    )
  }
}

export const behaviorStatsRepository = new BehaviorStatsRepository()
