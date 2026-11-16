import { beforeEach, describe, expect, it, vi } from 'vitest'

import { THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY } from '@/core/memory/third-party-corpus-import-state'
import type { ThirdPartyCorpusImportState } from '@/core/memory/third-party-corpus-import-state'
import {
  clearThirdPartyCorpusImportState,
  readThirdPartyCorpusImportState,
  writeThirdPartyCorpusImportState
} from '@/infrastructure/storage/third-party-corpus-import-storage'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  const local = {
    get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
      if (typeof keys === 'string') {
        return { [keys]: store[keys] }
      }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map(key => [key, store[key]]))
      }
      return { ...store, ...keys }
    }),
    set: vi.fn(async (items: StorageMap) => {
      Object.assign(store, items)
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const key of keyList) {
        delete store[key]
      }
    })
  }
  return { storage: { local }, store }
}

function makeState(
  source: 'raindrop' | 'pocket',
  overrides: Partial<ThirdPartyCorpusImportState> = {}
): ThirdPartyCorpusImportState {
  return {
    status: 'completed',
    source,
    importedCount: 3,
    totalCount: 3,
    startedAt: '2026-11-16T10:00:00.000Z',
    finishedAt: '2026-11-16T10:00:01.000Z',
    ...overrides
  }
}

describe('third-party-corpus-import-storage', () => {
  let store: StorageMap

  beforeEach(() => {
    const mock = createChromeStorageMock()
    store = mock.store
    vi.stubGlobal('chrome', mock)
  })

  it('按来源读写互不干扰', async () => {
    const raindrop = makeState('raindrop', { importedCount: 2 })
    const pocket = makeState('pocket', { importedCount: 5 })
    await writeThirdPartyCorpusImportState('raindrop', raindrop)
    await writeThirdPartyCorpusImportState('pocket', pocket)

    expect(await readThirdPartyCorpusImportState('raindrop')).toEqual(raindrop)
    expect(await readThirdPartyCorpusImportState('pocket')).toEqual(pocket)
  })

  it('旧单条格式迁移为 map 并写回', async () => {
    const legacy = makeState('raindrop', { importedCount: 7 })
    store[THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY] = legacy

    expect(await readThirdPartyCorpusImportState('raindrop')).toEqual(legacy)
    expect(await readThirdPartyCorpusImportState('pocket')).toBeNull()
    expect(store[THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY]).toEqual({ raindrop: legacy })
  })

  it('clearThirdPartyCorpusImportState 只清单来源', async () => {
    await writeThirdPartyCorpusImportState('raindrop', makeState('raindrop'))
    await writeThirdPartyCorpusImportState('pocket', makeState('pocket'))
    await clearThirdPartyCorpusImportState('raindrop')

    expect(await readThirdPartyCorpusImportState('raindrop')).toBeNull()
    expect(await readThirdPartyCorpusImportState('pocket')).not.toBeNull()
  })
})
