/**
 * 退出 / 被挤掉后：把当前账号桶 remap 回 localProfile，使未登录工作库仍可 Recall（ADR-018）。
 */

import { getOrCreateLocalProfile } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/**
 * 将 `accountId` 下全部 Memory（含软删）迁回本机档。
 * @returns 迁移条数；id 相同或空桶为 0
 */
export async function releaseAccountLibraryToLocalProfile(accountId: string): Promise<number> {
  const startedAt = flowStart('Identity', '账号库释放回本地档', { accountId })
  try {
    const profile = await getOrCreateLocalProfile()
    if (profile.localProfileId === accountId) {
      flowOk('Identity', '账号库释放回本地档', startedAt, { remapped: 0, reason: 'same_id' })
      return 0
    }
    const remapped = await memoryItemRepository.remapOwnerId(accountId, profile.localProfileId)
    flowOk('Identity', '账号库释放回本地档', startedAt, {
      remapped,
      fromOwnerId: accountId,
      toOwnerId: profile.localProfileId
    })
    return remapped
  } catch (error) {
    flowFail('Identity', '账号库释放回本地档', startedAt, error)
    throw error
  }
}
