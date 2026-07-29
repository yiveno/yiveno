/**
 * 存量 MemoryItem enrichment 回填（规则合并 tags/keywords/entities）。
 * 按 chrome.storage.local 版本号幂等；失败下次启动重试。
 */

import { mergeEnrichmentIntoMemoryItem } from '@/core/memory/enrich-memory-clues'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  MEMORY_ENRICHMENT_BACKFILL_STORAGE_KEY,
  MEMORY_ENRICHMENT_BACKFILL_VERSION,
  MemoryEnrichmentBackfillStateSchema
} from '@/core/memory/memory-enrichment-backfill'
import { logger } from '@/infrastructure/logging/logger'
import {
  memoryItemRepository,
  type MemoryItemRepository
} from '@/infrastructure/indexeddb/memory-item-repository'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 与 Recall 扫描上限对齐，避免一次回填拖垮 SW。 */
const MEMORY_ENRICHMENT_BACKFILL_SCAN_LIMIT = 10000

export type MemoryEnrichmentBackfillResult = {
  status: 'skipped' | 'completed'
  scanned: number
  updated: number
  version: number
}

/** 若本地版本落后则扫描全库合并 enrichment。 */
export async function ensureMemoryEnrichmentBackfilled(
  repository: MemoryItemRepository = memoryItemRepository
): Promise<MemoryEnrichmentBackfillResult> {
  const existing = await readChromeStorageLocal(
    MEMORY_ENRICHMENT_BACKFILL_STORAGE_KEY,
    MemoryEnrichmentBackfillStateSchema
  )

  if (existing && existing.version >= MEMORY_ENRICHMENT_BACKFILL_VERSION) {
    return {
      status: 'skipped',
      scanned: 0,
      updated: 0,
      version: existing.version
    }
  }

  const items = await repository.listByOwner({
    limit: MEMORY_ENRICHMENT_BACKFILL_SCAN_LIMIT
  })

  const changed: MemoryItem[] = []
  for (const item of items) {
    const merged = mergeEnrichmentIntoMemoryItem(item)
    if (merged.changed) {
      changed.push(merged.item)
    }
  }

  if (changed.length > 0) {
    await repository.putMany(changed)
  }

  await writeChromeStorageLocal(MEMORY_ENRICHMENT_BACKFILL_STORAGE_KEY, {
    version: MEMORY_ENRICHMENT_BACKFILL_VERSION
  })

  logger.info('MemoryEnrichmentBackfill', '存量 enrichment 回填完成', {
    scanned: items.length,
    updated: changed.length,
    version: MEMORY_ENRICHMENT_BACKFILL_VERSION
  })

  return {
    status: 'completed',
    scanned: items.length,
    updated: changed.length,
    version: MEMORY_ENRICHMENT_BACKFILL_VERSION
  }
}
