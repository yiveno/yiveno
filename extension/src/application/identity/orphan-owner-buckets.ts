/**
 * 本机多 owner 孤儿桶：换号后残留的其它 accountId（及异常 owner）。
 * 保留集 = localProfileId ∪ 当前 AccountBinding.accountId（若已登录）。
 * 禁止静默删除；盘点 / 导出 / 清除由设置页显式触发。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  getAccountBinding,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export interface OrphanOwnerBucketSummary {
  /** 孤儿 owner 个数（totalCount > 0） */
  orphanBucketCount: number
  /** 孤儿桶未软删条数之和（UI 展示） */
  orphanActiveCount: number
  /** 孤儿桶含软删总条数（清除 / 导出用） */
  orphanTotalCount: number
  orphanOwnerIds: string[]
}

/** 当前应保留的 owner 集合。 */
export async function resolveKeptOwnerIds(): Promise<Set<string>> {
  const [profile, binding] = await Promise.all([getOrCreateLocalProfile(), getAccountBinding()])
  const keep = new Set<string>([profile.localProfileId])
  if (binding) {
    keep.add(binding.accountId)
  }
  return keep
}

/** 盘点保留集外的 owner 桶。 */
export async function summarizeOrphanOwnerBuckets(): Promise<OrphanOwnerBucketSummary> {
  const startedAt = flowStart('Identity', '盘点孤儿 owner 桶')
  try {
    const keep = await resolveKeptOwnerIds()
    const summaries = await memoryItemRepository.listOwnerBucketSummaries()
    const orphans = summaries.filter(row => !keep.has(row.ownerId) && row.totalCount > 0)

    const result: OrphanOwnerBucketSummary = {
      orphanBucketCount: orphans.length,
      orphanActiveCount: orphans.reduce((sum, row) => sum + row.activeCount, 0),
      orphanTotalCount: orphans.reduce((sum, row) => sum + row.totalCount, 0),
      orphanOwnerIds: orphans.map(row => row.ownerId)
    }
    flowOk('Identity', '盘点孤儿 owner 桶', startedAt, {
      orphanBucketCount: result.orphanBucketCount,
      orphanActiveCount: result.orphanActiveCount,
      orphanTotalCount: result.orphanTotalCount
    })
    return result
  } catch (error) {
    flowFail('Identity', '盘点孤儿 owner 桶', startedAt, error)
    throw error
  }
}

/** 导出孤儿桶全部条目（含软删），供用户备份后再清。 */
export async function exportOrphanOwnerBuckets(): Promise<MemoryItem[]> {
  const startedAt = flowStart('Identity', '导出孤儿 owner 桶')
  try {
    const summary = await summarizeOrphanOwnerBuckets()
    const items: MemoryItem[] = []
    for (const ownerId of summary.orphanOwnerIds) {
      const bucket = await memoryItemRepository.listAllByOwnerId(ownerId, {
        includeDeleted: true
      })
      items.push(...bucket)
    }
    flowOk('Identity', '导出孤儿 owner 桶', startedAt, {
      orphanBucketCount: summary.orphanBucketCount,
      itemCount: items.length
    })
    return items
  } catch (error) {
    flowFail('Identity', '导出孤儿 owner 桶', startedAt, error)
    throw error
  }
}

/**
 * 硬删全部孤儿桶（不动保留集）。
 * @returns 清除的桶数与条目数
 */
export async function clearOrphanOwnerBuckets(): Promise<{
  clearedBuckets: number
  clearedItems: number
}> {
  const startedAt = flowStart('Identity', '清除孤儿 owner 桶')
  try {
    const summary = await summarizeOrphanOwnerBuckets()
    let clearedItems = 0
    for (const ownerId of summary.orphanOwnerIds) {
      const before = await memoryItemRepository.listAllByOwnerId(ownerId, {
        includeDeleted: true
      })
      await memoryItemRepository.replaceOwnerItems(ownerId, [])
      clearedItems += before.length
    }
    const result = {
      clearedBuckets: summary.orphanOwnerIds.length,
      clearedItems
    }
    flowOk('Identity', '清除孤儿 owner 桶', startedAt, result)
    return result
  } catch (error) {
    flowFail('Identity', '清除孤儿 owner 桶', startedAt, error)
    throw error
  }
}
