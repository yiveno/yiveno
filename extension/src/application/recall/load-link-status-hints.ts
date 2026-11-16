/**
 * 加载死链巡检 hint map（Side Panel 轨；Omnibox 不调）。
 * fail-open：读库失败返回空 map。
 */

import type { RecallLinkStatusHint } from '@/core/recall/keyword-filter'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryLinkStatusRepository } from '@/infrastructure/indexeddb/memory-link-status-repository'
import { logger } from '@/infrastructure/logging/logger'

/** owner 下全部巡检结论 → itemId → hint。 */
export async function loadLinkStatusHintsByItemId(): Promise<Map<string, RecallLinkStatusHint>> {
  try {
    const ownerId = await getCurrentOwnerId()
    const rows = await memoryLinkStatusRepository.listByOwner(ownerId)
    const map = new Map<string, RecallLinkStatusHint>()
    for (const row of rows) {
      map.set(row.sourceMemoryItemId, {
        linkStatus: row.linkStatus,
        consecutiveFailures: row.consecutiveFailures,
        ...(row.firstStaleAt ? { firstStaleAt: row.firstStaleAt } : {})
      })
    }
    return map
  } catch (error) {
    logger.warn('Dreaming', '加载死链巡检 hint 失败（fail-open）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return new Map()
  }
}
