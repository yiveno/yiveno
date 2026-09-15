/**
 * 冷启动 enrichment 批次进度读写（chrome.storage.local）。
 */
import {
  COLD_START_ENRICHMENT_BATCH_STORAGE_KEY,
  ColdStartEnrichmentBatchSchema,
  type ColdStartEnrichmentBatch
} from '@/core/memory/cold-start-enrichment-batch'
import { logger } from '@/infrastructure/logging/logger'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取当前冷启动 enrichment 批次（无则 null）。 */
export async function readColdStartEnrichmentBatch(): Promise<ColdStartEnrichmentBatch | null> {
  return readChromeStorageLocal(
    COLD_START_ENRICHMENT_BATCH_STORAGE_KEY,
    ColdStartEnrichmentBatchSchema
  )
}

async function writeBatch(batch: ColdStartEnrichmentBatch): Promise<ColdStartEnrichmentBatch> {
  await writeChromeStorageLocal(COLD_START_ENRICHMENT_BATCH_STORAGE_KEY, batch)
  return batch
}

/** 开始新批次（覆盖旧批）。total=0 不写。 */
export async function beginColdStartEnrichmentBatch(input: {
  batchId: string
  total: number
}): Promise<ColdStartEnrichmentBatch | null> {
  const total = Math.max(0, Math.floor(input.total))
  if (total <= 0 || !input.batchId.trim()) {
    return null
  }
  const batch: ColdStartEnrichmentBatch = {
    batchId: input.batchId.trim(),
    total,
    settled: 0,
    status: 'running',
    updatedAt: new Date().toISOString()
  }
  logger.info('ColdStart', 'enrichment 批次已开始', {
    batchId: batch.batchId,
    total: batch.total
  })
  return writeBatch(batch)
}

/** 单条任务结算（成功/跳过/失败均 +1）。 */
export async function settleColdStartEnrichmentBatchItem(
  batchId: string
): Promise<ColdStartEnrichmentBatch | null> {
  const current = await readColdStartEnrichmentBatch()
  if (!current || current.batchId !== batchId) {
    return current
  }
  if (current.status === 'paused_quota' || current.status === 'cleared') {
    return current
  }
  if (current.settled >= current.total) {
    return current.status === 'completed'
      ? current
      : writeBatch({
          ...current,
          status: 'completed',
          updatedAt: new Date().toISOString()
        })
  }

  const settled = current.settled + 1
  const status = settled >= current.total ? 'completed' : current.status
  const next: ColdStartEnrichmentBatch = {
    ...current,
    settled,
    status,
    updatedAt: new Date().toISOString()
  }
  return writeBatch(next)
}

/** 日配额熔断：进度停住，剩余任务不再计入。 */
export async function pauseColdStartEnrichmentBatchForQuota(): Promise<void> {
  const current = await readColdStartEnrichmentBatch()
  if (!current || current.status !== 'running') {
    return
  }
  await writeBatch({
    ...current,
    status: 'paused_quota',
    updatedAt: new Date().toISOString()
  })
  logger.warn('ColdStart', 'enrichment 批次因配额暂停', {
    batchId: current.batchId,
    settled: current.settled,
    total: current.total
  })
}

/** 非配额清队列：剩余记入 settled，状态 cleared。 */
export async function clearColdStartEnrichmentBatchRemainder(): Promise<void> {
  const current = await readColdStartEnrichmentBatch()
  if (!current || current.status !== 'running') {
    return
  }
  await writeBatch({
    ...current,
    settled: current.total,
    status: 'cleared',
    updatedAt: new Date().toISOString()
  })
  logger.info('ColdStart', 'enrichment 批次因清队列结束', {
    batchId: current.batchId,
    total: current.total
  })
}
