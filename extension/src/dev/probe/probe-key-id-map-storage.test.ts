/**
 * probe key→id 映射存储单测（chrome.storage.local mock）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, unknown>()

vi.mock('@/infrastructure/storage/chrome-storage-local', () => ({
  readChromeStorageLocal: async <T>(
    key: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }
  ): Promise<T | null> => {
    const raw = storage.get(key)
    if (raw === undefined) {
      return null
    }
    const parsed = schema.safeParse(raw)
    return parsed.success ? parsed.data : null
  },
  writeChromeStorageLocal: async (key: string, value: unknown): Promise<void> => {
    storage.set(key, value)
  },
  removeChromeStorageLocal: async (key: string | string[]): Promise<void> => {
    const keys = Array.isArray(key) ? key : [key]
    for (const item of keys) {
      storage.delete(item)
    }
  }
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import {
  clearProbeKeyIdMap,
  mergeProbeKeyIdMap,
  pruneProbeKeyIdMapByMemoryIds,
  readProbeKeyIdMap,
  replaceProbeKeyIdMap
} from './probe-key-id-map-storage'

describe('probe-key-id-map-storage', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('replace 整表写入；merge 覆盖同 key', async () => {
    await replaceProbeKeyIdMap({
      entries: { a: 'id-a', b: 'id-b' },
      seedContext: {
        recipeId: 'curated-clean',
        personas: ['researcher'],
        fillerSeed: 1,
        diversityBookmarkCount: 0,
        diversityExcerptCount: 0,
        noiseBookmarkCount: 0,
        noiseExcerptCount: 0
      }
    })
    await mergeProbeKeyIdMap({
      entries: { b: 'id-b2', c: 'id-c' },
      seedContext: {
        personas: ['researcher', 'creator'],
        fillerSeed: 2,
        diversityBookmarkCount: 10,
        diversityExcerptCount: 5,
        noiseBookmarkCount: 1,
        noiseExcerptCount: 1
      }
    })
    const map = await readProbeKeyIdMap()
    expect(map.entries).toEqual({ a: 'id-a', b: 'id-b2', c: 'id-c' })
    expect(map.seedContext?.fillerSeed).toBe(2)
  })

  it('按 Memory id 剪枝；清空抹表', async () => {
    await replaceProbeKeyIdMap({
      entries: { a: 'id-a', b: 'id-b', c: 'id-c' },
      seedContext: {
        personas: ['developer'],
        fillerSeed: 9,
        diversityBookmarkCount: 0,
        diversityExcerptCount: 0,
        noiseBookmarkCount: 0,
        noiseExcerptCount: 0
      }
    })
    const pruned = await pruneProbeKeyIdMapByMemoryIds(new Set(['id-b', 'id-c']))
    expect(pruned.removedKeys).toBe(2)
    expect(pruned.remaining).toBe(1)
    const map = await readProbeKeyIdMap()
    expect(map.entries).toEqual({ a: 'id-a' })

    await clearProbeKeyIdMap()
    const empty = await readProbeKeyIdMap()
    expect(empty.entries).toEqual({})
    expect(empty.seedContext).toBeNull()
  })
})
