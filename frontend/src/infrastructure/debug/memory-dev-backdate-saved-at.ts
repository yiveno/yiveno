/**
 * DEV：将 MemoryItem 保存时刻回溯（TTE 冷却 / 时间窗手测）。
 * 仅 import.meta.env.DEV；禁止生产路径与对外 Beta 达标宣称。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** UTC 正午回溯 N 天 → ISO（与探针 seeder 对齐，避免时区抖动）。 */
export function daysAgoToSavedAtIso(daysAgo: number): string {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString()
}

export type BackdateMemorySavedAtInput = {
  ids: readonly string[]
  daysAgo?: number
  savedAtIso?: string
}

export type BackdateMemorySavedAtResult = {
  savedAtIso: string
  updated: Array<{ id: string; type: MemoryItem['type']; savedAtIso: string }>
  notFound: string[]
}

function resolveTargetSavedAtIso(input: BackdateMemorySavedAtInput): string {
  if (input.savedAtIso) {
    return input.savedAtIso
  }
  if (input.daysAgo !== undefined) {
    return daysAgoToSavedAtIso(input.daysAgo)
  }
  throw new Error('须指定 daysAgo 或 savedAtIso 之一')
}

/**
 * 回溯条目保存时刻（createdAt；书签同步 chromeCreatedAt）。
 * 不重建倒排；Recall 时间窗读运行时字段。
 */
export async function backdateMemorySavedAt(
  input: BackdateMemorySavedAtInput
): Promise<BackdateMemorySavedAtResult> {
  if (!import.meta.env.DEV) {
    throw new Error('backdateMemorySavedAt 仅允许 DEV 构建')
  }

  const savedAtIso = resolveTargetSavedAtIso(input)
  const startedAt = flowStart('DevMemory', '回溯保存时刻', {
    count: input.ids.length,
    savedAtIso
  })

  try {
    const ownerId = await getCurrentOwnerId()
    const updated: BackdateMemorySavedAtResult['updated'] = []
    const notFound: string[] = []

    for (const id of input.ids) {
      const item = await memoryItemRepository.setSavedAtForDev(id, savedAtIso, ownerId)
      if (!item) {
        notFound.push(id)
        continue
      }
      updated.push({ id: item.id, type: item.type, savedAtIso })
    }

    const result: BackdateMemorySavedAtResult = { savedAtIso, updated, notFound }
    flowOk('DevMemory', '回溯保存时刻', startedAt, {
      updated: updated.length,
      notFound: notFound.length
    })
    return result
  } catch (error) {
    flowFail('DevMemory', '回溯保存时刻', startedAt, error)
    throw error
  }
}
