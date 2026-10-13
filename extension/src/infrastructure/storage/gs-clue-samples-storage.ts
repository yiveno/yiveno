/**
 * Getting Started 示意 clue session 缓存（同会话同书签不重复烧配额）。
 */

import { z } from 'zod'

import {
  readChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

const GS_CLUE_SAMPLES_SESSION_KEY = 'yiveno.gsClueSamples.v1'

const CachedSchema = z.object({
  cacheKey: z.string().min(1),
  title: z.string(),
  url: z.string().optional(),
  clues: z.array(z.string().min(1)).min(1).max(4),
  /** llm：Worker；template：标题模板回退 */
  origin: z.enum(['llm', 'template'])
})

export type GsClueSamplesCacheEntry = z.infer<typeof CachedSchema>

export function buildGsClueSamplesCacheKey(input: {
  chromeId: string
  title: string
  url?: string
}): string {
  return `${input.chromeId}|${input.title.trim().toLowerCase()}|${(input.url ?? '').trim()}`
}

export async function readGsClueSamplesCache(
  cacheKey: string
): Promise<GsClueSamplesCacheEntry | null> {
  const parsed = await readChromeStorageSession(GS_CLUE_SAMPLES_SESSION_KEY, CachedSchema)
  if (!parsed || parsed.cacheKey !== cacheKey) {
    return null
  }
  return parsed
}

export async function writeGsClueSamplesCache(entry: GsClueSamplesCacheEntry): Promise<void> {
  await writeChromeStorageSession(GS_CLUE_SAMPLES_SESSION_KEY, entry)
}
