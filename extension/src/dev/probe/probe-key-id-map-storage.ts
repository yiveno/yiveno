/**
 * DEV-only：probe key → MemoryItem id 映射（chrome.storage.local）。
 * 种库写入、清理剪枝、批量 runner 读期望 id。
 */

import { z } from 'zod'

import { RecallProbePersonaSchema } from '@/core/messaging/debug-messages'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'
import { logger } from '@/infrastructure/logging/logger'

export const PROBE_KEY_ID_MAP_STORAGE_KEY = 'yiveno.dev.probeKeyIdMap.v1'

const seedContextSchema = z.object({
  recipeId: z.string().optional(),
  personas: z.array(RecallProbePersonaSchema).min(1).max(5),
  fillerSeed: z.number().int().min(0).max(0xffff_ffff),
  diversityBookmarkCount: z.number().int().min(0),
  diversityExcerptCount: z.number().int().min(0),
  noiseBookmarkCount: z.number().int().min(0),
  noiseExcerptCount: z.number().int().min(0)
})

const probeKeyIdMapSchema = z.object({
  version: z.literal(1),
  updatedAtIso: z.string(),
  seedContext: seedContextSchema.nullable(),
  /** probe key → MemoryItem id */
  entries: z.record(z.string(), z.string())
})

export type ProbeSeedContext = z.infer<typeof seedContextSchema>
export type ProbeKeyIdMapStore = z.infer<typeof probeKeyIdMapSchema>

export async function readProbeKeyIdMap(): Promise<ProbeKeyIdMapStore> {
  const stored = await readChromeStorageLocal(PROBE_KEY_ID_MAP_STORAGE_KEY, probeKeyIdMapSchema)
  if (stored) {
    return stored
  }
  return {
    version: 1,
    updatedAtIso: new Date(0).toISOString(),
    seedContext: null,
    entries: {}
  }
}

export async function writeProbeKeyIdMap(store: ProbeKeyIdMapStore): Promise<void> {
  await writeChromeStorageLocal(PROBE_KEY_ID_MAP_STORAGE_KEY, store)
}

/** replace 种库：整表重写。 */
export async function replaceProbeKeyIdMap(input: {
  entries: Record<string, string>
  seedContext: ProbeSeedContext
}): Promise<ProbeKeyIdMapStore> {
  const next: ProbeKeyIdMapStore = {
    version: 1,
    updatedAtIso: new Date().toISOString(),
    seedContext: input.seedContext,
    entries: { ...input.entries }
  }
  await writeProbeKeyIdMap(next)
  logger.info('DevProbe', '已整表写入 probe key→id 映射', {
    mappedCount: Object.keys(next.entries).length,
    fillerSeed: input.seedContext.fillerSeed
  })
  return next
}

/** 非 replace：合并写入（同 key 覆盖）。 */
export async function mergeProbeKeyIdMap(input: {
  entries: Record<string, string>
  seedContext: ProbeSeedContext
}): Promise<ProbeKeyIdMapStore> {
  const current = await readProbeKeyIdMap()
  const next: ProbeKeyIdMapStore = {
    version: 1,
    updatedAtIso: new Date().toISOString(),
    seedContext: input.seedContext,
    entries: {
      ...current.entries,
      ...input.entries
    }
  }
  await writeProbeKeyIdMap(next)
  logger.info('DevProbe', '已合并写入 probe key→id 映射', {
    addedOrUpdated: Object.keys(input.entries).length,
    mappedCount: Object.keys(next.entries).length
  })
  return next
}

/** 按已删除 MemoryItem id 剪枝；若清空全部则可选 wipe。 */
export async function pruneProbeKeyIdMapByMemoryIds(
  purgedMemoryIds: ReadonlySet<string>
): Promise<{ removedKeys: number; remaining: number }> {
  if (purgedMemoryIds.size === 0) {
    const current = await readProbeKeyIdMap()
    return { removedKeys: 0, remaining: Object.keys(current.entries).length }
  }
  const current = await readProbeKeyIdMap()
  const nextEntries: Record<string, string> = {}
  let removedKeys = 0
  for (const [key, memoryId] of Object.entries(current.entries)) {
    if (purgedMemoryIds.has(memoryId)) {
      removedKeys += 1
      continue
    }
    nextEntries[key] = memoryId
  }
  const next: ProbeKeyIdMapStore = {
    version: 1,
    updatedAtIso: new Date().toISOString(),
    seedContext: Object.keys(nextEntries).length === 0 ? null : current.seedContext,
    entries: nextEntries
  }
  await writeProbeKeyIdMap(next)
  logger.info('DevProbe', '清理后已剪枝 probe key→id 映射', {
    removedKeys,
    remaining: Object.keys(nextEntries).length
  })
  return { removedKeys, remaining: Object.keys(nextEntries).length }
}

/** 整库清空时抹掉映射。 */
export async function clearProbeKeyIdMap(): Promise<void> {
  await removeChromeStorageLocal(PROBE_KEY_ID_MAP_STORAGE_KEY)
  logger.info('DevProbe', '已清空 probe key→id 映射')
}
