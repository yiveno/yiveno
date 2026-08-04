/**
 * 登录后将未登录期间写入的 localProfile 桶归并到当前 accountId。
 * 仅改本机 IndexedDB，不上云（登录 ≠ 同步）。
 */

import { getOrCreateLocalProfile } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/**
 * 把 `localProfileId` 下全部 Memory（含软删）remap 到 `accountId`。
 * @returns 迁移条数；已无残留或 id 相同时为 0
 */
export async function absorbLocalProfileIntoAccount(accountId: string): Promise<number> {
  const startedAt = flowStart('Identity', '归并本地档到账号', { accountId })
  const profile = await getOrCreateLocalProfile()
  if (profile.localProfileId === accountId) {
    flowOk('Identity', '归并本地档到账号', startedAt, { remapped: 0, reason: 'same_id' })
    return 0
  }

  const remapped = await memoryItemRepository.remapOwnerId(profile.localProfileId, accountId)
  flowOk('Identity', '归并本地档到账号', startedAt, {
    remapped,
    fromOwnerId: profile.localProfileId,
    toOwnerId: accountId
  })
  return remapped
}
