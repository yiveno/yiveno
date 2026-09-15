/**
 * 冷启动 LLM enrichment 批次进度（本轮入队 done/total；非全库监视）。
 */
import { z } from 'zod'

export const COLD_START_ENRICHMENT_BATCH_STORAGE_KEY = 'yiveno.coldStartEnrichmentBatch' as const

/**
 * 批次状态。
 * - running：串行队列进行中
 * - paused_quota：日配额熔断，剩余任务已丢弃；进度停在 settled
 * - completed：settled === total 且正常跑完
 * - cleared：非配额原因清空队列（剩余记入 settled）
 */
export const ColdStartEnrichmentBatchStatusSchema = z.enum([
  'running', // 进行中
  'paused_quota', // 配额暂停
  'completed', // 本批完成
  'cleared' // 队列被清空（非配额）
])

export const ColdStartEnrichmentBatchSchema = z.object({
  batchId: z.string().min(1),
  total: z.number().int().nonnegative(),
  settled: z.number().int().nonnegative(),
  status: ColdStartEnrichmentBatchStatusSchema,
  updatedAt: z.string().datetime()
})

export type ColdStartEnrichmentBatch = z.infer<typeof ColdStartEnrichmentBatchSchema>

/** 0–1；total=0 视为 1（无任务）。 */
export function coldStartEnrichmentBatchProgressRatio(batch: ColdStartEnrichmentBatch): number {
  if (batch.total <= 0) {
    return 1
  }
  return Math.min(1, Math.max(0, batch.settled / batch.total))
}

/** 轻条是否应展示本批进度（不含 dismiss / TTL；由调用方叠）。 */
export function shouldShowColdStartEnrichmentBatchProgress(
  batch: ColdStartEnrichmentBatch | null | undefined
): boolean {
  if (!batch || batch.total <= 0) {
    return false
  }
  if (batch.status === 'paused_quota') {
    return true
  }
  if (batch.status === 'running' && batch.settled < batch.total) {
    return true
  }
  return false
}
