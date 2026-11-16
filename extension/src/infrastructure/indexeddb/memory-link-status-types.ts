/**
 * `memory_link_status` Zod 形状与主键工具（死链巡检派生；不进 Backup）。
 */

import { z } from 'zod'

/** 巡检结论闭集。 */
export const MemoryLinkStatusValueSchema = z.enum([
  'ok', // 最近检查可达
  'stale', // 连续死链失败达阈值
  'unknown' // 未检查 / 巡检失败（离线·超时），不得当 stale
])

/** 主键：`` `${ownerId}\0${sourceMemoryItemId}` `` */
export function buildMemoryLinkStatusId(ownerId: string, sourceMemoryItemId: string): string {
  return `${ownerId}\0${sourceMemoryItemId}`
}

export const MemoryLinkStatusRecordSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().uuid(),
  sourceMemoryItemId: z.string().uuid(),
  linkStatus: MemoryLinkStatusValueSchema,
  /** 最后检查时间；无记录 = 未检查，优先排队，不得当 stale。 */
  lastCheckedAt: z.string().datetime(),
  /** 首次发现 stale（降权坡度用）。 */
  firstStaleAt: z.string().datetime().optional(),
  /** 连续死链失败次数（网络/超时不计入）。 */
  consecutiveFailures: z.number().int().nonnegative()
})

export type MemoryLinkStatusRecord = z.infer<typeof MemoryLinkStatusRecordSchema>
