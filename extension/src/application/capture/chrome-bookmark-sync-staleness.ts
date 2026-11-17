/**
 * 书签同步关时的「未同步进库」叶子计数（只读；不 upsert）。
 * 供 Side Panel cold-start 探针 / GET_BOOKMARK_SYNC_STALENESS。
 */

import { readChromeBookmarkImportState } from '@/application/capture/chrome-bookmark-bulk-import'
import { isChromeBookmarkSyncEnabled } from '@/application/capture/chrome-bookmark-sync-service'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { readChromeBookmarkLeaves } from '@/infrastructure/browser/chrome-bookmark-reader'
import { logger } from '@/infrastructure/logging/logger'
import { readChromeBookmarkDeleteTombstoneIds } from '@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage'

/**
 * 统计 Chrome 有、本机 Memory 对齐表无、且非墓碑的书签叶子数。
 * - 同步开 → 0（持续同步会收；不提示 stale）
 * - 导入未完成 → 0（勿与「还没导入」混淆）
 * - 失败抛错（调用方置 null，不显示信号）
 */
export async function countUnsyncedChromeBookmarkLeaves(): Promise<number> {
  if (await isChromeBookmarkSyncEnabled()) {
    return 0
  }

  const importState = await readChromeBookmarkImportState()
  if (importState?.status !== 'completed') {
    return 0
  }

  const [leaves, alignment, tombstones] = await Promise.all([
    readChromeBookmarkLeaves(),
    memoryItemService.listBookmarkSyncAlignment(),
    readChromeBookmarkDeleteTombstoneIds()
  ])

  let unsyncedCount = 0
  for (const leaf of leaves) {
    if (tombstones.has(leaf.chromeBookmarkId)) {
      continue
    }
    if (!alignment.byChromeBookmarkId.has(leaf.chromeBookmarkId)) {
      unsyncedCount += 1
    }
  }

  logger.info('ChromeBookmarkSync', '未同步书签计数完成', {
    leafCount: leaves.length,
    unsyncedCount,
    tombstoneCount: tombstones.size
  })
  return unsyncedCount
}
