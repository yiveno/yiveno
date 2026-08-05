import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { handleRecallWithClue } from '@/background/handlers/recall-handler'
import {
  handleCaptureBookmark,
  handleRecordMemoryOpen,
  handleRecordRecallDismiss
} from '@/background/handlers/memory-handler'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }

  return {
    storage: {
      local: {
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
        remove: vi.fn(async () => undefined)
      }
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('recall-handler', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('handleRecallWithClue 返回 Top Pick', async () => {
    await handleCaptureBookmark({
      title: '留存分析方法论',
      url: 'https://example.com/retention'
    })

    const response = await handleRecallWithClue({ clue: '留存' })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.result.outcome).toBe('top_pick')
    expect(response.result.topPick?.item.payload).toMatchObject({
      title: '留存分析方法论'
    })
  })

  it('handleRecallWithClue 无数据时 no_match', async () => {
    const response = await handleRecallWithClue({ clue: '不存在的内容' })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.result.outcome).toBe('no_match')
  })

  it('否定反馈后同线索应改选竞争者', async () => {
    const preferred = await handleCaptureBookmark({
      title: 'Yiveno 设计原则',
      url: 'https://docs.yiveno.com/design'
    })
    const alternative = await handleCaptureBookmark({
      title: 'Yiveno 产品文档',
      url: 'https://docs.yiveno.com/product'
    })
    expect(preferred.ok && alternative.ok).toBe(true)
    if (!preferred.ok || !('item' in preferred) || !alternative.ok || !('item' in alternative)) {
      return
    }

    const opened = await handleRecordMemoryOpen({ id: preferred.item.id })
    expect(opened.ok).toBe(true)

    const before = await handleRecallWithClue({ clue: 'Yiveno' })
    expect(before.ok).toBe(true)
    if (!before.ok) {
      return
    }
    expect(before.result.topPick?.item.id).toBe(preferred.item.id)

    for (let i = 0; i < 3; i += 1) {
      const dismissed = await handleRecordRecallDismiss({ ids: [preferred.item.id] })
      expect(dismissed.ok).toBe(true)
    }

    const after = await handleRecallWithClue({ clue: 'Yiveno' })
    expect(after.ok).toBe(true)
    if (!after.ok) {
      return
    }
    expect(after.result.topPick?.item.id).toBe(alternative.item.id)
    expect(after.result.topPick?.item.id).not.toBe(preferred.item.id)
  })

  it('多轮 context：短补充 yesterday 承接 prior 内容词', async () => {
    await handleCaptureBookmark({
      title: 'Li Bai poem notes',
      url: 'https://example.com/li-bai'
    })

    const first = await handleRecallWithClue({ clue: 'poem about Li Bai' })
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }
    expect(first.result.parsed).toBeTruthy()

    const second = await handleRecallWithClue({
      clue: 'yesterday',
      context: {
        priorUserUtterances: ['poem about Li Bai'],
        ...(first.result.parsed ? { accumulated: first.result.parsed } : {})
      }
    })
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }

    expect(second.result.effectiveClue).toContain('poem about Li Bai')
    expect(second.result.parsed?.objectTypes).toContain('poem')
    expect(second.result.parsed?.timeRange?.label).toBe('yesterday')
    expect(second.result.outcome).toBe('top_pick')
    expect(second.result.topPick?.item.payload).toMatchObject({
      title: 'Li Bai poem notes'
    })
  })

  it('context.dismissedIds 硬排除候选', async () => {
    const preferred = await handleCaptureBookmark({
      title: 'Yiveno Alpha Doc',
      url: 'https://docs.yiveno.com/alpha'
    })
    const alternative = await handleCaptureBookmark({
      title: 'Yiveno Beta Doc',
      url: 'https://docs.yiveno.com/beta'
    })
    expect(preferred.ok && alternative.ok).toBe(true)
    if (!preferred.ok || !('item' in preferred) || !alternative.ok || !('item' in alternative)) {
      return
    }

    const withDismiss = await handleRecallWithClue({
      clue: 'Yiveno',
      context: { dismissedIds: [preferred.item.id] }
    })
    expect(withDismiss.ok).toBe(true)
    if (!withDismiss.ok) {
      return
    }

    const ids = [
      withDismiss.result.topPick?.item.id,
      ...withDismiss.result.alsoPossible.map(m => m.item.id)
    ].filter(Boolean)
    expect(ids).not.toContain(preferred.item.id)
    expect(ids).toContain(alternative.item.id)
  })
})
