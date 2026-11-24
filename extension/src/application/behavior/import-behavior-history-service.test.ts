/**
 * 浏览记录导入：分页游标、max 合并、去 fragment、http 过滤、失败跳过。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearBehaviorHistoryData,
  importBehaviorHistory
} from '@/application/behavior/import-behavior-history-service'
import { BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY } from '@/core/behavior/behavior-history-import-state'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { behaviorStatsRepository } from '@/infrastructure/indexeddb/behavior-stats-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

import 'fake-indexeddb/auto'

type StorageMap = Record<string, unknown>

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

function createChromeMock(options: { granted: boolean; batches: chrome.history.HistoryItem[][] }) {
  const store: StorageMap = {
    [LOCAL_PROFILE_STORAGE_KEY]: localProfile
  }
  let batchIndex = 0
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
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key]
          }
        })
      }
    },
    permissions: {
      request: vi.fn(async () => options.granted)
    },
    history: {
      search: vi.fn(async () => {
        const batch = options.batches[batchIndex] ?? []
        batchIndex += 1
        return batch
      })
    },
    _store: store
  }
}

describe('importBehaviorHistory', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('权限拒绝 → failed，不写行为行', async () => {
    const chromeMock = createChromeMock({ granted: false, batches: [] })
    vi.stubGlobal('chrome', chromeMock)
    const state = await importBehaviorHistory()
    expect(state.status).toBe('failed')
    expect(state.errorCode).toBe('BEHAVIOR_IMPORT_PERMISSION_DENIED')
    expect(await behaviorStatsRepository.listByOwner(localProfile.localProfileId)).toHaveLength(0)
  })

  it('已授权时 request 直通并继续 history.search', async () => {
    const now = Date.now()
    const chromeMock = createChromeMock({
      granted: true,
      batches: [
        [
          {
            id: 'ok',
            url: 'https://example.com/',
            visitCount: 2,
            lastVisitTime: now
          }
        ]
      ]
    })
    vi.stubGlobal('chrome', chromeMock)
    const state = await importBehaviorHistory()
    expect(chromeMock.permissions.request).toHaveBeenCalledWith({ permissions: ['history'] })
    expect(chromeMock.history.search).toHaveBeenCalled()
    expect(state.status).toBe('completed')
    expect(state.importedCount).toBe(1)
  })

  it('分页游标 + 去 fragment + 跳过非 http + max 合并', async () => {
    const now = Date.now()
    // 第一批满 1000 才会继续翻页；单测用小批模拟末页 + 第二次导入测 max 合并
    const chromeMock = createChromeMock({
      granted: true,
      batches: [
        [
          {
            id: '1',
            url: 'https://github.com/yiveno#readme',
            visitCount: 5,
            lastVisitTime: now - 1000
          },
          {
            id: '2',
            url: 'chrome://extensions',
            visitCount: 9,
            lastVisitTime: now - 2000
          },
          {
            id: '3',
            url: 'https://example.com/a',
            visitCount: 2,
            lastVisitTime: now - 3000
          }
        ]
      ]
    })
    vi.stubGlobal('chrome', chromeMock)

    const state = await importBehaviorHistory()
    expect(state.status).toBe('completed')
    expect(state.importedCount).toBe(2)
    expect(chromeMock.history.search).toHaveBeenCalled()

    // 重导入：visitCount 更低但 lastVisitTime 更新 → 次数不降、时间取 max
    const chromeMock2 = createChromeMock({
      granted: true,
      batches: [
        [
          {
            id: '4',
            url: 'https://github.com/yiveno',
            visitCount: 3,
            lastVisitTime: now - 500
          }
        ]
      ]
    })
    vi.stubGlobal('chrome', chromeMock2)
    await importBehaviorHistory()

    const rows = await behaviorStatsRepository.listByOwner(localProfile.localProfileId)
    const github = rows.find(row => row.domain === 'github.com')
    expect(github?.url).toBe('https://github.com/yiveno')
    expect(github?.visitCount).toBe(5)
    expect(github?.lastVisitTime).toBe(now - 500)
    expect(rows.some(row => row.url.startsWith('chrome:'))).toBe(false)
  })

  it('满批后按 endTime 游标继续翻页', async () => {
    const now = Date.now()
    const fullBatch = Array.from({ length: 1000 }, (_, index) => ({
      id: `p${index}`,
      url: `https://page${index}.example/`,
      visitCount: 1,
      lastVisitTime: now - index
    }))
    const chromeMock = createChromeMock({
      granted: true,
      batches: [
        fullBatch,
        [
          {
            id: 'tail',
            url: 'https://tail.example/',
            visitCount: 1,
            lastVisitTime: now - 2000
          }
        ]
      ]
    })
    vi.stubGlobal('chrome', chromeMock)
    const state = await importBehaviorHistory()
    expect(state.status).toBe('completed')
    expect(chromeMock.history.search.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(state.importedCount).toBeGreaterThanOrEqual(1001)
  })

  it('清除行为数据删表并重置导入状态', async () => {
    const chromeMock = createChromeMock({
      granted: true,
      batches: [
        [
          {
            id: '1',
            url: 'https://example.com/',
            visitCount: 1,
            lastVisitTime: Date.now()
          }
        ],
        []
      ]
    })
    vi.stubGlobal('chrome', chromeMock)
    await importBehaviorHistory()
    expect(chromeMock._store[BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY]).toBeTruthy()

    const { deleted } = await clearBehaviorHistoryData()
    expect(deleted).toBeGreaterThanOrEqual(1)
    expect(await behaviorStatsRepository.listByOwner(localProfile.localProfileId)).toHaveLength(0)
    expect(chromeMock._store[BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY]).toBeUndefined()
  })
})
