/**
 * NLG 门禁度量 → chrome.storage.local 适配器。
 * core 只认 NlgGateMetricsPersist；本文件承担 Chrome 调用。
 */

import { z } from 'zod'

import {
  configureNlgGateMetricsPersist,
  hydrateNlgGateMetricsFromPersist,
  NLG_GATE_METRICS_STORAGE_KEY,
  type NlgGateMetricsPersist,
  type NlgGateMetricsStore
} from '@/core/recall/understand/nlg-gate-metrics'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

const DayBucketSchema = z.object({
  day: z.string().min(8).max(16),
  counts: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative()))
})

const StoreSchema = z.object({
  version: z.literal(1),
  days: z.array(DayBucketSchema).max(32)
})

/** chrome.storage 落盘实现。 */
export const chromeNlgGateMetricsPersist: NlgGateMetricsPersist = {
  async read(): Promise<NlgGateMetricsStore | null> {
    return readChromeStorageLocal(NLG_GATE_METRICS_STORAGE_KEY, StoreSchema)
  },
  async write(store: NlgGateMetricsStore): Promise<void> {
    await writeChromeStorageLocal(NLG_GATE_METRICS_STORAGE_KEY, store)
  }
}

/** Background / UI 入口：接线 + 预热读盘。失败静默。 */
export async function installNlgGateMetricsChromeStorage(): Promise<void> {
  configureNlgGateMetricsPersist(chromeNlgGateMetricsPersist)
  await hydrateNlgGateMetricsFromPersist()
}
