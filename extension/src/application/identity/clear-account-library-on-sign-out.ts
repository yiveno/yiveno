/**
 * 退出 / 被挤掉（ADR-018 · 口径 A）：清本机账号桶痕迹。
 * - 书签壳 remap 回 localProfile（跟 Chrome Profile，不上云）
 * - 其余（含摘录）从本机删除，不并进本地档装成无主
 */

import { getOrCreateLocalProfile } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export interface ClearAccountLibraryOnSignOutResult {
  /** 从账号桶删除的条数（含软删摘录等；书签已先迁走则不含） */
  clearedCount: number
  /** 迁回本地档的书签条数 */
  remappedBookmarks: number
}

/**
 * 清掉 `accountId` 在本机的账号侧 Memory。
 * @returns 删除条数与书签回迁条数；id 相同则为 0
 */
export async function clearAccountLibraryOnSignOut(
  accountId: string
): Promise<ClearAccountLibraryOnSignOutResult> {
  const startedAt = flowStart('Identity', '退出清账号桶', { accountId })
  try {
    const profile = await getOrCreateLocalProfile()
    if (profile.localProfileId === accountId) {
      flowOk('Identity', '退出清账号桶', startedAt, {
        clearedCount: 0,
        remappedBookmarks: 0,
        reason: 'same_id'
      })
      return { clearedCount: 0, remappedBookmarks: 0 }
    }

    const remappedBookmarks = await memoryItemRepository.remapOwnerIdByType(
      accountId,
      profile.localProfileId,
      'bookmark'
    )

    const remaining = await memoryItemRepository.listAllByOwnerId(accountId, {
      includeDeleted: true
    })
    const clearedCount = remaining.length
    if (clearedCount > 0) {
      await memoryItemRepository.replaceOwnerItems(accountId, [])
    }

    flowOk('Identity', '退出清账号桶', startedAt, {
      clearedCount,
      remappedBookmarks,
      fromOwnerId: accountId,
      toOwnerId: profile.localProfileId
    })
    return { clearedCount, remappedBookmarks }
  } catch (error) {
    flowFail('Identity', '退出清账号桶', startedAt, error)
    throw error
  }
}
