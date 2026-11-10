/**
 * 扫孤儿命题：源 MemoryItem 已硬删 / 不在 owner 桶内 → 删命题行。
 */

import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import { logger } from '@/infrastructure/logging/logger'

/** 扫描并删除孤儿命题；返回删除条数。 */
export async function sweepOrphanMemoryNotes(ownerId?: string): Promise<{ deleted: number }> {
  const resolvedOwnerId = ownerId ?? (await getCurrentOwnerId())
  const items = await memoryItemRepository.listAllByOwnerId(resolvedOwnerId, {
    includeDeleted: true
  })
  // 软删源：命题标脏由下次编译重算；硬删/缺失才算孤儿
  const existingIds = new Set(items.filter(item => item.deletedAt == null).map(item => item.id))

  const deleted = await memoryNotesRepository.sweepOrphans({
    ownerId: resolvedOwnerId,
    existingSourceIds: existingIds
  })
  logger.info('Dreaming', '孤儿扫完成', {
    ownerId: resolvedOwnerId,
    deleted,
    liveSourceCount: existingIds.size
  })
  return { deleted }
}
