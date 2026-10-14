/**
 * 登录迁移门闸（ADR-018）：禁止静默 absorb。
 * 本机存在不属于当前 accountId 的摘录时，须用户显式 Import / Export / Delete。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  getAccountBinding,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export interface LoginMigrationSummary {
  /** 是否需要弹窗 */
  pending: boolean
  /** 未归属当前账号的摘录条数（仅未软删） */
  excerptCount: number
  /** 含此类摘录的 ownerId 列表 */
  sourceOwnerIds: string[]
  /**
   * 本地档上的书签条数（Import 时一并迁入本机工作库归属，不上云——ADR-017）。
   * 仅统计 localProfileId，不含孤儿桶书签。
   */
  localBookmarkCount: number
}

/** 收集「非当前账号」且含未软删摘录的 owner。 */
async function collectForeignExcerptOwners(accountId: string): Promise<{
  sourceOwnerIds: string[]
  excerptCount: number
  localBookmarkCount: number
}> {
  const profile = await getOrCreateLocalProfile()
  const summaries = await memoryItemRepository.listOwnerBucketSummaries()
  const sourceOwnerIds: string[] = []
  let excerptCount = 0

  for (const row of summaries) {
    if (row.ownerId === accountId || row.activeCount === 0) {
      continue
    }
    const items = await memoryItemRepository.listAllByOwnerId(row.ownerId, {
      includeDeleted: false
    })
    const excerpts = items.filter(item => item.type === 'text_excerpt')
    if (excerpts.length === 0) {
      continue
    }
    sourceOwnerIds.push(row.ownerId)
    excerptCount += excerpts.length
  }

  let localBookmarkCount = 0
  if (profile.localProfileId !== accountId) {
    const localItems = await memoryItemRepository.listAllByOwnerId(profile.localProfileId, {
      includeDeleted: false
    })
    localBookmarkCount = localItems.filter(item => item.type === 'bookmark').length
  }

  return { sourceOwnerIds, excerptCount, localBookmarkCount }
}

/** 盘点登录后是否须弹迁移门闸。 */
export async function summarizeLoginMigration(accountId: string): Promise<LoginMigrationSummary> {
  const startedAt = flowStart('Identity', '盘点登录迁移门闸', { accountId })
  try {
    const { sourceOwnerIds, excerptCount, localBookmarkCount } =
      await collectForeignExcerptOwners(accountId)
    const result: LoginMigrationSummary = {
      pending: excerptCount > 0,
      excerptCount,
      sourceOwnerIds,
      localBookmarkCount
    }
    flowOk('Identity', '盘点登录迁移门闸', startedAt, {
      pending: result.pending,
      excerptCount: result.excerptCount,
      sourceOwnerCount: result.sourceOwnerIds.length,
      localBookmarkCount: result.localBookmarkCount
    })
    return result
  } catch (error) {
    flowFail('Identity', '盘点登录迁移门闸', startedAt, error)
    throw error
  }
}

/**
 * Import：未归属摘录 → 当前账号；本地档书签一并归属（本机连续，不上云）。
 * 孤儿桶内书签不自动导入（仍走孤儿导出/清除）。
 */
export async function importLoginMigration(accountId: string): Promise<{
  importedExcerpts: number
  remappedLocalBookmarks: number
}> {
  const startedAt = flowStart('Identity', '登录迁移 Import', { accountId })
  try {
    const profile = await getOrCreateLocalProfile()
    const { sourceOwnerIds } = await collectForeignExcerptOwners(accountId)

    let importedExcerpts = 0
    for (const ownerId of sourceOwnerIds) {
      importedExcerpts += await memoryItemRepository.remapOwnerIdByType(
        ownerId,
        accountId,
        'text_excerpt'
      )
    }

    let remappedLocalBookmarks = 0
    if (profile.localProfileId !== accountId) {
      remappedLocalBookmarks = await memoryItemRepository.remapOwnerIdByType(
        profile.localProfileId,
        accountId,
        'bookmark'
      )
    }

    flowOk('Identity', '登录迁移 Import', startedAt, {
      importedExcerpts,
      remappedLocalBookmarks,
      sourceOwnerCount: sourceOwnerIds.length
    })
    return { importedExcerpts, remappedLocalBookmarks }
  } catch (error) {
    flowFail('Identity', '登录迁移 Import', startedAt, error)
    throw error
  }
}

/** Export：导出未归属摘录（含软删，便于完整备份）。 */
export async function exportLoginMigrationExcerpts(accountId: string): Promise<MemoryItem[]> {
  const startedAt = flowStart('Identity', '登录迁移 Export', { accountId })
  try {
    const summaries = await memoryItemRepository.listOwnerBucketSummaries()
    const items: MemoryItem[] = []
    for (const row of summaries) {
      if (row.ownerId === accountId || row.totalCount === 0) {
        continue
      }
      const bucket = await memoryItemRepository.listAllByOwnerId(row.ownerId, {
        includeDeleted: true
      })
      items.push(...bucket.filter(item => item.type === 'text_excerpt'))
    }
    flowOk('Identity', '登录迁移 Export', startedAt, { itemCount: items.length })
    return items
  } catch (error) {
    flowFail('Identity', '登录迁移 Export', startedAt, error)
    throw error
  }
}

/** Delete：硬删未归属摘录（含软删行；不动书签壳）。 */
export async function deleteLoginMigrationExcerpts(accountId: string): Promise<{
  deletedCount: number
}> {
  const startedAt = flowStart('Identity', '登录迁移 Delete', { accountId })
  try {
    const items = await exportLoginMigrationExcerpts(accountId)
    const deletedCount = await memoryItemRepository.hardDeleteMany(items.map(item => item.id))
    flowOk('Identity', '登录迁移 Delete', startedAt, { deletedCount })
    return { deletedCount }
  } catch (error) {
    flowFail('Identity', '登录迁移 Delete', startedAt, error)
    throw error
  }
}

/**
 * 在已登录前提下盘点门闸（无 binding 则不 pending）。
 * 供 GET_LOGIN_MIGRATION_STATUS 使用。
 */
export async function summarizeLoginMigrationForCurrentBinding(): Promise<LoginMigrationSummary> {
  const binding = await getAccountBinding()
  if (!binding) {
    return {
      pending: false,
      excerptCount: 0,
      sourceOwnerIds: [],
      localBookmarkCount: 0
    }
  }
  return summarizeLoginMigration(binding.accountId)
}
