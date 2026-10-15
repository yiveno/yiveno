/**
 * 登录迁移门闸（ADR-018）：禁止静默 absorb。
 * 无主摘录 = **未登录期间**写在 localProfile 桶的 text_excerpt；
 * 退出会清账号桶，故门闸不服务「外账号残留桶」。
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
  /** 无主摘录条数（仅未软删） */
  excerptCount: number
  /** 含无主摘录的 ownerId（仅可能为 localProfileId） */
  sourceOwnerIds: string[]
  /**
   * 本地档上的书签条数（Import 时一并迁入本机工作库归属，不上云——ADR-017）。
   */
  localBookmarkCount: number
}

/** 仅盘点本地档无主摘录（未登录创造）。 */
async function collectUnownedLocalExcerpts(accountId: string): Promise<{
  sourceOwnerIds: string[]
  excerptCount: number
  localBookmarkCount: number
}> {
  const profile = await getOrCreateLocalProfile()
  if (profile.localProfileId === accountId) {
    return { sourceOwnerIds: [], excerptCount: 0, localBookmarkCount: 0 }
  }

  const localItems = await memoryItemRepository.listAllByOwnerId(profile.localProfileId, {
    includeDeleted: false
  })
  const excerpts = localItems.filter(item => item.type === 'text_excerpt')
  const bookmarks = localItems.filter(item => item.type === 'bookmark')

  return {
    sourceOwnerIds: excerpts.length > 0 ? [profile.localProfileId] : [],
    excerptCount: excerpts.length,
    localBookmarkCount: bookmarks.length
  }
}

/** 盘点登录后是否须弹迁移门闸。 */
export async function summarizeLoginMigration(accountId: string): Promise<LoginMigrationSummary> {
  const startedAt = flowStart('Identity', '盘点登录迁移门闸', { accountId })
  try {
    const { sourceOwnerIds, excerptCount, localBookmarkCount } =
      await collectUnownedLocalExcerpts(accountId)
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
 * Import：本地档无主摘录 → 当前账号；本地档书签一并归属（本机连续，不上云）。
 */
export async function importLoginMigration(accountId: string): Promise<{
  importedExcerpts: number
  remappedLocalBookmarks: number
}> {
  const startedAt = flowStart('Identity', '登录迁移 Import', { accountId })
  try {
    const profile = await getOrCreateLocalProfile()
    const { sourceOwnerIds } = await collectUnownedLocalExcerpts(accountId)

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

/** Export：导出本地档无主摘录（含软删，便于完整备份）。 */
export async function exportLoginMigrationExcerpts(accountId: string): Promise<MemoryItem[]> {
  const startedAt = flowStart('Identity', '登录迁移 Export', { accountId })
  try {
    const profile = await getOrCreateLocalProfile()
    if (profile.localProfileId === accountId) {
      flowOk('Identity', '登录迁移 Export', startedAt, { itemCount: 0 })
      return []
    }
    const bucket = await memoryItemRepository.listAllByOwnerId(profile.localProfileId, {
      includeDeleted: true
    })
    const items = bucket.filter(item => item.type === 'text_excerpt')
    flowOk('Identity', '登录迁移 Export', startedAt, { itemCount: items.length })
    return items
  } catch (error) {
    flowFail('Identity', '登录迁移 Export', startedAt, error)
    throw error
  }
}

/**
 * Delete：硬删本地档无主摘录（含软删行；不动书签壳）。
 * 不用 hardDeleteMany（其按当前 owner=accountId 过滤，删不到本地档）。
 */
export async function deleteLoginMigrationExcerpts(accountId: string): Promise<{
  deletedCount: number
}> {
  const startedAt = flowStart('Identity', '登录迁移 Delete', { accountId })
  try {
    const profile = await getOrCreateLocalProfile()
    if (profile.localProfileId === accountId) {
      flowOk('Identity', '登录迁移 Delete', startedAt, { deletedCount: 0 })
      return { deletedCount: 0 }
    }
    const localItems = await memoryItemRepository.listAllByOwnerId(profile.localProfileId, {
      includeDeleted: true
    })
    const remaining = localItems.filter(item => item.type !== 'text_excerpt')
    const deletedCount = localItems.length - remaining.length
    if (deletedCount > 0) {
      await memoryItemRepository.replaceOwnerItems(profile.localProfileId, remaining)
    }
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
