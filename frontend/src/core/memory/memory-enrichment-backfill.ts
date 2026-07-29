import { z } from 'zod'

/** chrome.storage.local：enrichment 存量回填进度。 */
export const MEMORY_ENRICHMENT_BACKFILL_STORAGE_KEY = 'yiveno.memoryEnrichmentBackfill'

/**
 * 回填版本。规则词典大变时递增，触发再跑一遍存量合并。
 * v1：P0 域名 / 类型词 / 实体词典。
 * v2：recall 导向 keywords（类型补充词 + 正文词面规则 + 扩展域名）。
 */
export const MEMORY_ENRICHMENT_BACKFILL_VERSION = 2

export const MemoryEnrichmentBackfillStateSchema = z.object({
  version: z.number().int().nonnegative()
})

export type MemoryEnrichmentBackfillState = z.infer<typeof MemoryEnrichmentBackfillStateSchema>
