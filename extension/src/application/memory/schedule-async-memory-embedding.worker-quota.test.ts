/**
 * Worker embed 配额熔断 / 回填前预查（复现 + 门禁）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { MemoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

const {
  requestWorkerEmbeddingsMock,
  getWorkerApiAccessTokenMock,
  getUserSettingsMock,
  fetchHostedQuotaMock
} = vi.hoisted(() => ({
  requestWorkerEmbeddingsMock: vi.fn(),
  getWorkerApiAccessTokenMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  fetchHostedQuotaMock: vi.fn()
}))

vi.mock('@/infrastructure/ai/embed-api-client', async () => {
  const actual = await vi.importActual<typeof import('@/infrastructure/ai/embed-api-client')>(
    '@/infrastructure/ai/embed-api-client'
  )
  return {
    ...actual,
    requestWorkerEmbeddings: requestWorkerEmbeddingsMock
  }
})

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getWorkerApiAccessTokenMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock
}))

vi.mock('@/infrastructure/ai/hosted-quota-api-client', () => ({
  fetchHostedQuota: fetchHostedQuotaMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    getById: vi.fn(),
    listByOwner: vi.fn(),
    putEnrichmentClues: vi.fn()
  }
}))

import {
  resetSilentMemoryEmbeddingMaintenanceForTests,
  runSilentMemoryEmbeddingMaintenance
} from '@/application/memory/ensure-memory-embedding-maintenance'
import {
  clearAsyncMemoryEmbeddingQueue,
  enqueueMissingMemoryEmbeddings,
  resetAsyncMemoryEmbeddingStateForTests,
  resumeAsyncMemoryEmbeddingAfterAuth,
  runAsyncMemoryEmbedding,
  scheduleAsyncMemoryEmbedding
} from '@/application/memory/schedule-async-memory-embedding'
import {
  isEmbedQuotaBreakerOpenSync,
  resetEmbedQuotaCircuitBreakerForTests
} from '@/infrastructure/ai/embed-quota-circuit-breaker'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

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
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key]
          }
        })
      }
    }
  }
}

function defaultSettings() {
  return {
    selectionToolbarEnabled: true,
    aiFeaturesEnabled: true,
    contentExtractEnabled: false,
    linkStatusSweepEnabled: true,
    chromeBookmarkIngestEnabled: true,
    chromeBookmarkSyncEnabled: false,
    mcpReadOnlyEnabled: false,
    recallOutcomePairSoftAdjustEnabled: true,
    dualThreadLocalLearningEnabled: false,
    dualThreadContributeAggregatesEnabled: false,
    uiLocalePreference: 'system' as const,
    voiceRecallOpenEnabled: true
  }
}

function hostedQuota(embedRemaining: number) {
  return {
    model: '@cf/meta/llama',
    tier: 'anonymous' as const,
    used: 0,
    limit: 15,
    remaining: 15,
    dailyUsed: 0,
    dailyLimit: 15,
    dailyRemaining: 15,
    monthKey: 'lifetime',
    embedUsed: 30 - embedRemaining,
    embedLimit: 30,
    embedRemaining
  }
}

function excerptMissing(id: string): MemoryItem {
  return createTextExcerptMemoryItem({
    ownerId: 'o',
    sourceLocalProfileId: 'p',
    payload: {
      selectedText: `excerpt body ${id} long enough for embed`,
      sourceUrl: `https://example.com/${id}`,
      pageTitle: id
    },
    now: () => '2026-11-22T00:00:00.000Z'
  })
}

function bookmarkMissing(id: string, createdAt: string): MemoryItem {
  return createBookmarkMemoryItem({
    ownerId: 'o',
    sourceLocalProfileId: 'p',
    payload: {
      title: `bookmark ${id}`,
      url: `https://example.com/b/${id}`,
      chromeBookmarkId: id
    },
    now: () => createdAt
  })
}

function mockOkEmbeddings(): void {
  requestWorkerEmbeddingsMock.mockResolvedValue({
    model: '@cf/baai/bge-m3',
    dim: 4,
    embeddings: [[0.1, 0.2, 0.3, 0.4]]
  })
}

function wireRepo(items: MemoryItem[]): void {
  const byId = new Map(items.map(item => [item.id, item]))
  vi.mocked(memoryItemRepository.getById).mockImplementation(async id => byId.get(id) ?? null)
  vi.mocked(memoryItemRepository.listByOwner).mockImplementation(async options => {
    const type = options?.type
    if (type === 'text_excerpt') {
      return items.filter(item => item.type === 'text_excerpt')
    }
    if (type === 'bookmark') {
      return items.filter(item => item.type === 'bookmark')
    }
    return items
  })
  vi.mocked(memoryItemRepository.putEnrichmentClues).mockImplementation(async next => {
    byId.set(next.id, next)
  })
}

/** 排空异步队列（真实 timer：任务间距 500ms）。 */
async function flushAsyncQueue(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>(resolve => {
      setTimeout(resolve, 550)
    })
  }
}

describe('Worker embed 配额熔断', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', createChromeStorageMock())
    resetEmbedQuotaCircuitBreakerForTests()
    resetAsyncMemoryEmbeddingStateForTests()
    resetSilentMemoryEmbeddingMaintenanceForTests()
    requestWorkerEmbeddingsMock.mockReset()
    getWorkerApiAccessTokenMock.mockReset()
    getUserSettingsMock.mockReset()
    fetchHostedQuotaMock.mockReset()
    vi.mocked(memoryItemRepository.getById).mockReset()
    vi.mocked(memoryItemRepository.listByOwner).mockReset()
    vi.mocked(memoryItemRepository.putEnrichmentClues).mockReset()

    getWorkerApiAccessTokenMock.mockResolvedValue('device-token')
    getUserSettingsMock.mockResolvedValue(defaultSettings())
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota(30))
    vi.mocked(memoryItemRepository.putEnrichmentClues).mockResolvedValue(undefined)
  })

  afterEach(() => {
    clearAsyncMemoryEmbeddingQueue('test_teardown')
    resetAsyncMemoryEmbeddingStateForTests()
    resetSilentMemoryEmbeddingMaintenanceForTests()
    resetEmbedQuotaCircuitBreakerForTests()
    vi.useRealTimers()
  })

  it('复现：Worker quota_exceeded 后队列停止，后续任务不再调 Worker', async () => {
    vi.useFakeTimers()
    const a = excerptMissing('a')
    const b = excerptMissing('b')
    const c = excerptMissing('c')
    wireRepo([a, b, c])
    requestWorkerEmbeddingsMock.mockRejectedValue(new Error('quota_exceeded'))

    scheduleAsyncMemoryEmbedding(a.id)
    scheduleAsyncMemoryEmbedding(b.id)
    scheduleAsyncMemoryEmbedding(c.id)

    await vi.runAllTimersAsync()

    // 修前：3 次；修后：1 次后熔断
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)
  })

  it('http_429 同样触发 Worker 配额熔断', async () => {
    vi.useFakeTimers()
    const a = excerptMissing('a')
    const b = excerptMissing('b')
    wireRepo([a, b])
    requestWorkerEmbeddingsMock.mockRejectedValue(new Error('http_429'))

    scheduleAsyncMemoryEmbedding(a.id)
    scheduleAsyncMemoryEmbedding(b.id)
    await vi.runAllTimersAsync()

    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)
  })

  it('预查剩余 0：整轮跳过，requestWorkerEmbeddings 0 次', async () => {
    const a = excerptMissing('a')
    wireRepo([a])
    mockOkEmbeddings()
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota(0))

    const result = await runSilentMemoryEmbeddingMaintenance('test_zero')

    expect(result).toMatchObject({
      attempted: 0,
      written: 0,
      workerQuotaHit: false
    })
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(0)
    expect(fetchHostedQuotaMock).toHaveBeenCalledTimes(1)
  })

  it('预查剩余 N：总尝试条目数 ≤ N，摘录优先于书签', async () => {
    const e1 = excerptMissing('e1')
    const e2 = excerptMissing('e2')
    const b1 = bookmarkMissing('b1', '2026-11-22T12:00:00.000Z')
    const b2 = bookmarkMissing('b2', '2026-11-22T11:00:00.000Z')
    wireRepo([e1, e2, b1, b2])
    mockOkEmbeddings()
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota(2))

    await runSilentMemoryEmbeddingMaintenance('test_budget_n')
    await flushAsyncQueue(2)

    // 同步回填 limit=2 且只扫摘录 → 尝试 e1+e2；enqueueLimit=0 → 书签不入队
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(2)
    const writtenIds = vi
      .mocked(memoryItemRepository.putEnrichmentClues)
      .mock.calls.map(call => (call[0] as MemoryItem).id)
    expect(writtenIds).toEqual([e1.id, e2.id])
  })

  it('预查读失败：fail-open 旧行为继续；随后遇 quota 仍熔断', async () => {
    const a = excerptMissing('a')
    const b = excerptMissing('b')
    const c = excerptMissing('c')
    wireRepo([a, b, c])
    fetchHostedQuotaMock.mockRejectedValue(new Error('network_error'))
    requestWorkerEmbeddingsMock
      .mockResolvedValueOnce({
        model: '@cf/baai/bge-m3',
        dim: 4,
        embeddings: [[0.1, 0.2, 0.3, 0.4]]
      })
      .mockRejectedValueOnce(new Error('quota_exceeded'))
      .mockResolvedValue({
        model: '@cf/baai/bge-m3',
        dim: 4,
        embeddings: [[0.1, 0.2, 0.3, 0.4]]
      })

    await runSilentMemoryEmbeddingMaintenance('test_fail_open')

    // fail-open：同步尝试摘录；第 2 条配额熔断后 break → 恰 2 次 Worker
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(2)
  })

  it('预查剩余 > 0 清除之前置起的 Worker 配额熔断（持久化）', async () => {
    const a = excerptMissing('a')
    wireRepo([a])
    requestWorkerEmbeddingsMock.mockRejectedValueOnce(new Error('quota_exceeded'))

    // 先熔断
    await runAsyncMemoryEmbedding(a.id, memoryItemRepository as MemoryItemRepository)
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)

    // 入队应被熔断挡住
    scheduleAsyncMemoryEmbedding(a.id)
    await flushAsyncQueue(2)
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)

    // 预查剩余 > 0 → 清除熔断并继续回填
    mockOkEmbeddings()
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota(5))
    await runSilentMemoryEmbeddingMaintenance('test_clear_pause')

    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(2)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(false)
  }, 15_000)

  it('回填入口同身份 resume 不再清熔断', async () => {
    const a = excerptMissing('a')
    wireRepo([a])
    requestWorkerEmbeddingsMock.mockRejectedValue(new Error('quota_exceeded'))

    await runAsyncMemoryEmbedding(a.id, memoryItemRepository as MemoryItemRepository)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)

    // 同身份 resume / enqueue：熔断仍在，不再调 Worker
    await resumeAsyncMemoryEmbeddingAfterAuth('device-token')
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)

    await enqueueMissingMemoryEmbeddings(memoryItemRepository as MemoryItemRepository, 10)
    scheduleAsyncMemoryEmbedding(a.id)
    await flushAsyncQueue(2)
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)
  })

  it('换身份 resume 清熔断', async () => {
    const a = excerptMissing('a')
    wireRepo([a])
    requestWorkerEmbeddingsMock.mockRejectedValueOnce(new Error('quota_exceeded'))
    await runAsyncMemoryEmbedding(a.id, memoryItemRepository as MemoryItemRepository)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)

    await resumeAsyncMemoryEmbeddingAfterAuth('other-device-token-xyz')
    expect(isEmbedQuotaBreakerOpenSync()).toBe(false)

    mockOkEmbeddings()
    await runAsyncMemoryEmbedding(a.id, memoryItemRepository as MemoryItemRepository)
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(2)
  })
})
