/**
 * 每周死链巡检 tick：本机直连 URL → 写 `memory_link_status`。
 * 只降权、不删除、不改原文 / dismissCount / updatedAt / deletedAt。
 */

import {
  LINK_STATUS_STALE_FAILURE_THRESHOLD,
  LINK_STATUS_SWEEP_BATCH_LIMIT,
  LINK_STATUS_SWEEP_GAP_MS
} from '@/core/dreaming/dreaming-constants'
import type { MemoryItem } from '@/core/memory/memory-item'
import { checkMemoryLinkUrl } from '@/application/dreaming/check-memory-link-url'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import {
  buildMemoryLinkStatusId,
  type MemoryLinkStatusRecord
} from '@/infrastructure/indexeddb/memory-link-status-types'
import { memoryLinkStatusRepository } from '@/infrastructure/indexeddb/memory-link-status-repository'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

export type SweepMemoryLinkStatusResult = {
  skipped: boolean
  reason?: string
  checked: number
  markedStale: number
  markedUnknown: number
  markedOk: number
}

function resolveItemUrl(item: MemoryItem): string | null {
  if (item.type === 'bookmark') {
    const url = item.payload.url?.trim()
    return url && url.length > 0 ? url : null
  }
  if (item.type === 'text_excerpt') {
    const fromPayload = item.payload.sourceUrl?.trim()
    if (fromPayload) {
      return fromPayload
    }
    const fromClues = item.clues.sourceUrl?.trim()
    return fromClues && fromClues.length > 0 ? fromClues : null
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * 排队：无检查记录优先；再按 lastCheckedAt 升序。
 */
function pickBatch(
  items: MemoryItem[],
  existingBySource: Map<string, MemoryLinkStatusRecord>
): MemoryItem[] {
  const withUrl = items.filter(item => resolveItemUrl(item) != null)
  withUrl.sort((left, right) => {
    const leftRec = existingBySource.get(left.id)
    const rightRec = existingBySource.get(right.id)
    if (leftRec == null && rightRec != null) {
      return -1
    }
    if (leftRec != null && rightRec == null) {
      return 1
    }
    if (leftRec == null && rightRec == null) {
      return left.id.localeCompare(right.id)
    }
    return leftRec!.lastCheckedAt.localeCompare(rightRec!.lastCheckedAt)
  })
  return withUrl.slice(0, LINK_STATUS_SWEEP_BATCH_LIMIT)
}

function nextRecord(input: {
  ownerId: string
  item: MemoryItem
  previous: MemoryLinkStatusRecord | null
  outcome: 'ok' | 'dead' | 'probe_failed'
  nowIso: string
}): MemoryLinkStatusRecord {
  const id = buildMemoryLinkStatusId(input.ownerId, input.item.id)
  if (input.outcome === 'ok') {
    return {
      id,
      ownerId: input.ownerId,
      sourceMemoryItemId: input.item.id,
      linkStatus: 'ok',
      lastCheckedAt: input.nowIso,
      consecutiveFailures: 0
    }
  }
  if (input.outcome === 'probe_failed') {
    return {
      id,
      ownerId: input.ownerId,
      sourceMemoryItemId: input.item.id,
      linkStatus: 'unknown',
      lastCheckedAt: input.nowIso,
      consecutiveFailures: input.previous?.consecutiveFailures ?? 0,
      ...(input.previous?.firstStaleAt ? { firstStaleAt: input.previous.firstStaleAt } : {})
    }
  }
  // dead：连续失败 +1；达阈值升 stale
  const consecutiveFailures = (input.previous?.consecutiveFailures ?? 0) + 1
  const stale = consecutiveFailures >= LINK_STATUS_STALE_FAILURE_THRESHOLD
  return {
    id,
    ownerId: input.ownerId,
    sourceMemoryItemId: input.item.id,
    linkStatus: stale ? 'stale' : 'unknown',
    lastCheckedAt: input.nowIso,
    consecutiveFailures,
    ...(stale
      ? { firstStaleAt: input.previous?.firstStaleAt ?? input.nowIso }
      : input.previous?.firstStaleAt
        ? { firstStaleAt: input.previous.firstStaleAt }
        : {})
  }
}

/** 开关开时跑一批；失败 fail-open，不挡 Recall。 */
export async function sweepMemoryLinkStatusTick(): Promise<SweepMemoryLinkStatusResult> {
  try {
    const settings = await getUserSettings()
    if (!settings.linkStatusSweepEnabled) {
      logger.info('Dreaming', '死链巡检跳过：开关关闭')
      return {
        skipped: true,
        reason: 'sweep_disabled',
        checked: 0,
        markedStale: 0,
        markedUnknown: 0,
        markedOk: 0
      }
    }

    const ownerId = await getCurrentOwnerId()
    const listed = await memoryItemRepository.listByOwner({ limit: 10_000 })
    const existing = await memoryLinkStatusRepository.listByOwner(ownerId)
    const existingBySource = new Map(existing.map(row => [row.sourceMemoryItemId, row]))
    const batch = pickBatch(listed, existingBySource)

    let checked = 0
    let markedStale = 0
    let markedUnknown = 0
    let markedOk = 0

    for (let index = 0; index < batch.length; index += 1) {
      const item = batch[index]!
      const url = resolveItemUrl(item)
      if (!url) {
        continue
      }
      const outcome = await checkMemoryLinkUrl(url)
      const nowIso = new Date().toISOString()
      const record = nextRecord({
        ownerId,
        item,
        previous: existingBySource.get(item.id) ?? null,
        outcome,
        nowIso
      })
      await memoryLinkStatusRepository.putRecord(record)
      checked += 1
      if (record.linkStatus === 'stale') {
        markedStale += 1
      } else if (record.linkStatus === 'unknown') {
        markedUnknown += 1
      } else {
        markedOk += 1
      }
      if (index + 1 < batch.length) {
        await sleep(LINK_STATUS_SWEEP_GAP_MS)
      }
    }

    logger.info('Dreaming', '死链巡检 tick 完成', {
      checked,
      markedStale,
      markedUnknown,
      markedOk,
      batchSize: batch.length
    })
    return { skipped: false, checked, markedStale, markedUnknown, markedOk }
  } catch (error) {
    logger.warn('Dreaming', '死链巡检 tick 失败（fail-open）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      skipped: true,
      reason: 'tick_error',
      checked: 0,
      markedStale: 0,
      markedUnknown: 0,
      markedOk: 0
    }
  }
}

/** 单测 / 诊断：导出状态迁移纯函数。 */
export const __testOnlyNextLinkStatusRecord = nextRecord
