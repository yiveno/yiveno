/**
 * Dreaming 每日回顾 · 只读 application service。
 * 读命题 / 链路状态 / 来源标题 / AI 开关；分组与排序一律交给 core 纯函数。
 */

import { buildDailyReview, partitionNotesByLocalDay } from '@/core/dreaming/build-daily-review'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { GetDailyReviewResponse } from '@/core/messaging/daily-review-messages'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryLinkStatusRepository } from '@/infrastructure/indexeddb/memory-link-status-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'

/** 按 owner 扫命题的安全上限（实测远小于此；触顶记入响应）。 */
export const DAILY_REVIEW_NOTES_SCAN_LIMIT = 2000 as const

function sourceTitleFromItem(item: MemoryItem): string {
  const cluesTitle = item.clues.title?.trim() ?? ''
  if (cluesTitle) {
    return cluesTitle
  }
  if (item.type === 'bookmark') {
    return item.payload.title.trim()
  }
  return item.payload.pageTitle.trim()
}

/**
 * 组装每日回顾 DTO。
 * 不写任何表、不调 LLM、不触发编译。
 */
export async function buildDailyReviewForCurrentOwner(): Promise<GetDailyReviewResponse> {
  const ownerId = await getCurrentOwnerId()
  const settings = await getUserSettings()
  const aiFeaturesEnabled = settings.aiFeaturesEnabled

  const [notes, totalNotes, linkRows] = await Promise.all([
    memoryNotesRepository.listByOwnerUpdated({
      ownerId,
      limit: DAILY_REVIEW_NOTES_SCAN_LIMIT
    }),
    memoryNotesRepository.countByOwner(ownerId),
    memoryLinkStatusRepository.listByOwner(ownerId)
  ])

  const notesHitScanLimit = notes.length >= DAILY_REVIEW_NOTES_SCAN_LIMIT
  if (notesHitScanLimit) {
    logger.warn('Dreaming', '每日回顾命题扫描触顶', {
      ownerId,
      scanned: notes.length,
      limit: DAILY_REVIEW_NOTES_SCAN_LIMIT,
      totalNotes
    })
  }

  const { yesterdayNotes, olderNotes, recentNotes } = partitionNotesByLocalDay(notes)

  const staleSourceIds = new Set<string>()
  const staleFirstSeenAt = new Map<string, string>()
  for (const row of linkRows) {
    if (row.linkStatus !== 'stale') {
      continue
    }
    staleSourceIds.add(row.sourceMemoryItemId)
    if (row.firstStaleAt) {
      staleFirstSeenAt.set(row.sourceMemoryItemId, row.firstStaleAt)
    }
  }

  const sourceIds = new Set<string>()
  for (const note of notes) {
    sourceIds.add(note.sourceMemoryItemId)
  }
  const items = await memoryItemRepository.getManyByIds([...sourceIds], ownerId)
  const sourceTitles = new Map<string, string>()
  for (const item of items) {
    sourceTitles.set(item.id, sourceTitleFromItem(item))
  }

  const built = buildDailyReview({
    yesterdayNotes,
    olderNotes,
    recentNotes,
    staleSourceIds,
    staleFirstSeenAt,
    sourceTitles
  })

  logger.info('Dreaming', '每日回顾已组装', {
    ownerId,
    aiFeaturesEnabled,
    totalNotes,
    yesterdayCount: built.yesterdayNoteCount,
    groupCount: built.groups.length,
    hasFeatured: built.featured != null,
    hasStale: built.stale != null,
    skippedDirtyNotes: built.skippedDirtyNotes,
    notesHitScanLimit
  })

  return {
    ok: true,
    aiFeaturesEnabled,
    totalNotes,
    yesterdayCount: built.yesterdayNoteCount,
    groups: built.groups,
    featured: built.featured,
    stale: built.stale,
    skippedDirtyNotes: built.skippedDirtyNotes,
    groupsTruncated: built.groupsTruncated,
    notesHitScanLimit
  }
}
