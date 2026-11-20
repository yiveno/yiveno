/**
 * 退出 / 被挤掉退登：处理本机账号桶 Memory。
 * 默认（G1-a）：摘录 + 书签全部回迁到 localProfileId，不删。
 * opt-in `deleteLocalExcerpts`：旧口径 A——仅书签回迁，删除账号桶摘录等。
 */

import { getOrCreateLocalProfile } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export interface RemapAccountLibraryToLocalOptions {
  /**
   * true = 旧口径 A：删账号桶摘录（书签仍回迁）；
   * false / 缺省 = 全量回迁到 localProfileId，不删。
   */
  deleteLocalExcerpts?: boolean
}

export interface RemapAccountLibraryToLocalResult {
  /** 删除的账号桶条数（仅 deleteLocalExcerpts 时非 0） */
  clearedCount: number
  /** 迁回本地档的书签条数 */
  remappedBookmarks: number
  /** 迁回本地档的摘录等非书签条数（全量回迁时） */
  remappedExcerpts: number
}

/**
 * 将 `accountId` 桶回迁到本机 `localProfileId`（可复用：主动退出 / invalid 退登 / 后续 device token）。
 * @returns 删除条数与回迁条数；id 相同则为全 0
 */
export async function remapAccountLibraryToLocalProfile(
  accountId: string,
  options: RemapAccountLibraryToLocalOptions = {}
): Promise<RemapAccountLibraryToLocalResult> {
  const deleteLocalExcerpts = options.deleteLocalExcerpts === true
  const startedAt = flowStart('Identity', '账号桶回迁本地档', {
    accountId,
    deleteLocalExcerpts
  })
  try {
    const profile = await getOrCreateLocalProfile()
    if (profile.localProfileId === accountId) {
      flowOk('Identity', '账号桶回迁本地档', startedAt, {
        clearedCount: 0,
        remappedBookmarks: 0,
        remappedExcerpts: 0,
        reason: 'same_id'
      })
      return { clearedCount: 0, remappedBookmarks: 0, remappedExcerpts: 0 }
    }

    if (deleteLocalExcerpts) {
      // 旧口径 A：书签回迁，其余从本机删除
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
      flowOk('Identity', '账号桶回迁本地档', startedAt, {
        clearedCount,
        remappedBookmarks,
        remappedExcerpts: 0,
        mode: 'delete_excerpts',
        fromOwnerId: accountId,
        toOwnerId: profile.localProfileId
      })
      return { clearedCount, remappedBookmarks, remappedExcerpts: 0 }
    }

    // 默认：全量回迁（含软删），不删任何内容
    const before = await memoryItemRepository.listAllByOwnerId(accountId, {
      includeDeleted: true
    })
    const remappedBookmarks = before.filter(item => item.type === 'bookmark').length
    const remappedExcerpts = before.length - remappedBookmarks
    if (before.length > 0) {
      await memoryItemRepository.remapOwnerId(accountId, profile.localProfileId)
    }
    flowOk('Identity', '账号桶回迁本地档', startedAt, {
      clearedCount: 0,
      remappedBookmarks,
      remappedExcerpts,
      mode: 'remap_all',
      fromOwnerId: accountId,
      toOwnerId: profile.localProfileId
    })
    return { clearedCount: 0, remappedBookmarks, remappedExcerpts }
  } catch (error) {
    flowFail('Identity', '账号桶回迁本地档', startedAt, error)
    throw error
  }
}

/**
 * 退出路径入口：默认全量回迁；`deleteLocalExcerpts: true` 走旧口径 A。
 * 实现委托 {@link remapAccountLibraryToLocalProfile}，便于 E1' 等复用同一 helper。
 */
export async function clearAccountLibraryOnSignOut(
  accountId: string,
  options: RemapAccountLibraryToLocalOptions = {}
): Promise<RemapAccountLibraryToLocalResult> {
  return remapAccountLibraryToLocalProfile(accountId, options)
}
