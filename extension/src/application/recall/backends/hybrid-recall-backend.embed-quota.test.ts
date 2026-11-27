/**
 * Recall embed 熔断 / 预查：fuseHybridMatches（L718）+ Topic（L994）+ 语义命题（L1062）+ Omnibox。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTextExcerptMemoryItem } from '@/core/memory/create-memory-item'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding
} from '../../../../tests/eval/hybrid-fake-embedding'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

const {
  requestWorkerEmbeddingsMock,
  fetchHostedQuotaMock,
  getWorkerApiAccessTokenMock,
  understandRecallClueMock,
  listForKeywordRecallMock
} = vi.hoisted(() => ({
  requestWorkerEmbeddingsMock: vi.fn(),
  fetchHostedQuotaMock: vi.fn(),
  getWorkerApiAccessTokenMock: vi.fn(),
  understandRecallClueMock: vi.fn(),
  listForKeywordRecallMock: vi.fn()
}))

vi.mock('@/infrastructure/ai/embed-api-client', () => ({
  WORKER_EMBEDDING_MODEL: '@cf/baai/bge-m3',
  requestWorkerEmbeddings: requestWorkerEmbeddingsMock
}))

vi.mock('@/infrastructure/ai/hosted-quota-api-client', () => ({
  fetchHostedQuota: fetchHostedQuotaMock
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getWorkerApiAccessTokenMock
}))

vi.mock('@/core/dreaming/dreaming-constants', async importOriginal => {
  const actual = await importOriginal<typeof import('@/core/dreaming/dreaming-constants')>()
  return {
    ...actual,
    DREAMING_PREFER_READ_ENABLED: true,
    DREAMING_SEMANTIC_NOTE_MATCH_ENABLED: true
  }
})

vi.mock('@/core/recall/understand/understand-recall-clue', () => ({
  understandRecallClue: understandRecallClueMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: vi.fn(() => undefined),
  getClueLlmCompleterDetailed: vi.fn(() => undefined)
}))

vi.mock('@/infrastructure/browser/browser-online', async importOriginal => {
  const actual = await importOriginal<typeof import('@/infrastructure/browser/browser-online')>()
  return {
    ...actual,
    readBrowserOnline: vi.fn(() => true)
  }
})

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    list: vi.fn(async () => []),
    listForKeywordRecall: listForKeywordRecallMock
  }
}))

vi.mock('@/application/recall/apply-recall-context', () => ({
  applyPageContextToMatches: vi.fn((matches: unknown[]) => matches),
  applyStoredOutcomePairsToMatches: vi.fn(async (matches: unknown[]) => matches)
}))

vi.mock('@/application/recall/note-match-merge', () => ({
  mergeNoteMatchesForRecall: vi.fn(async (input: { listedItems: unknown[] }) => ({
    items: input.listedItems,
    noteMatches: new Map(),
    ownerId: null
  }))
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-meta-repository', () => ({
  memoryNotesMetaRepository: {
    recordNoteHit: vi.fn(async () => undefined)
  }
}))

import {
  fuseHybridMatches,
  HybridRecallBackend
} from '@/application/recall/backends/hybrid-recall-backend'
import { createRecallFlowTrace } from '@/application/recall/create-recall-flow-trace'
import {
  isEmbedQuotaBreakerOpenSync,
  resetEmbedQuotaCircuitBreakerForTests,
  tripEmbedQuotaBreaker
} from '@/infrastructure/ai/embed-quota-circuit-breaker'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  return {
    i18n: {
      getMessage: vi.fn((key: string) => key)
    },
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

const TOKEN = 'test-token-for-embed-quota-breaker'

function hostedQuota(embedRemaining?: number) {
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
    ...(embedRemaining !== undefined
      ? {
          embedUsed: 30 - embedRemaining,
          embedLimit: 30,
          embedRemaining
        }
      : {})
  }
}

function parsedClue(raw: string): ParsedRecallClue {
  return {
    raw,
    contentTerms: raw.split(/\s+/).filter(Boolean),
    confidence: 'high'
  }
}

function excerptWithEmbedding(id: string, text: string) {
  const item = createTextExcerptMemoryItem({
    ownerId: '00000000-0000-4000-8000-000000000001',
    sourceLocalProfileId: '00000000-0000-4000-8000-000000000002',
    payload: {
      selectedText: text,
      sourceUrl: 'https://example.com/a',
      pageTitle: text
    },
    now: () => '2026-11-22T00:00:00.000Z'
  })
  return {
    ...item,
    id,
    clues: {
      ...item.clues,
      embedding: makeFakeEmbedding(text, HYBRID_FAKE_EMBEDDING_DIM),
      embeddingModel: '@cf/baai/bge-m3',
      embeddingDim: HYBRID_FAKE_EMBEDDING_DIM
    }
  }
}

describe('HybridRecallBackend · embed 配额熔断', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', createChromeStorageMock())
    resetEmbedQuotaCircuitBreakerForTests()
    vi.clearAllMocks()
    getWorkerApiAccessTokenMock.mockResolvedValue(TOKEN)
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota(10))
    requestWorkerEmbeddingsMock.mockImplementation(async (_token: string, texts: string[]) => ({
      model: '@cf/baai/bge-m3',
      dim: HYBRID_FAKE_EMBEDDING_DIM,
      embeddings: texts.map(text => makeFakeEmbedding(text, HYBRID_FAKE_EMBEDDING_DIM))
    }))
    understandRecallClueMock.mockResolvedValue({
      disposition: 'proceed',
      rejectReason: null,
      mode: 'lexical',
      source: 'rules',
      clueTruncated: false,
      parsed: parsedClue('manifest v3 service worker'),
      filterClue: 'manifest v3 service worker'
    })
    const item = excerptWithEmbedding(
      '11111111-1111-4111-8111-111111111111',
      'manifest v3 service worker'
    )
    listForKeywordRecallMock.mockResolvedValue({ items: [item], source: 'scan' })
  })

  it('熔断开：fuseHybridMatches 不调 requestWorkerEmbeddings', async () => {
    tripEmbedQuotaBreaker(TOKEN)
    const item = excerptWithEmbedding(
      '11111111-1111-4111-8111-111111111111',
      'manifest v3 service worker'
    )
    const fused = await fuseHybridMatches({
      displayClue: 'manifest v3',
      pairClue: 'manifest v3',
      items: [item],
      filterClue: 'manifest v3',
      parsed: parsedClue('manifest v3'),
      clueEmbeddingText: 'manifest v3 service worker',
      trace: createRecallFlowTrace('RecallFlow')
    })
    expect(fused).toBeNull()
    expect(requestWorkerEmbeddingsMock).not.toHaveBeenCalled()
    expect(fetchHostedQuotaMock).not.toHaveBeenCalled()
  })

  it('quota_exceeded：trip + 降级（fuseHybridMatches 返回 null）', async () => {
    requestWorkerEmbeddingsMock.mockRejectedValue(new Error('quota_exceeded'))
    const item = excerptWithEmbedding(
      '11111111-1111-4111-8111-111111111111',
      'manifest v3 service worker'
    )
    const fused = await fuseHybridMatches({
      displayClue: 'manifest v3',
      pairClue: 'manifest v3',
      items: [item],
      filterClue: 'manifest v3',
      parsed: parsedClue('manifest v3'),
      clueEmbeddingText: 'manifest v3 service worker',
      trace: createRecallFlowTrace('RecallFlow')
    })
    expect(fused).toBeNull()
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)
  })

  it('预查 embedRemaining=0：跳过 Worker 调用', async () => {
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota(0))
    const item = excerptWithEmbedding(
      '11111111-1111-4111-8111-111111111111',
      'manifest v3 service worker'
    )
    const fused = await fuseHybridMatches({
      displayClue: 'manifest v3',
      pairClue: 'manifest v3',
      items: [item],
      filterClue: 'manifest v3',
      parsed: parsedClue('manifest v3'),
      clueEmbeddingText: 'manifest v3 service worker',
      trace: createRecallFlowTrace('RecallFlow')
    })
    expect(fused).toBeNull()
    expect(requestWorkerEmbeddingsMock).not.toHaveBeenCalled()
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)
  })

  it('预查 embedRemaining 未定义：放行并调用 Worker', async () => {
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota())
    const item = excerptWithEmbedding(
      '11111111-1111-4111-8111-111111111111',
      'manifest v3 service worker'
    )
    await fuseHybridMatches({
      displayClue: 'manifest v3',
      pairClue: 'manifest v3',
      items: [item],
      filterClue: 'manifest v3',
      parsed: parsedClue('manifest v3'),
      clueEmbeddingText: 'manifest v3 service worker',
      trace: createRecallFlowTrace('RecallFlow')
    })
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalled()
  })

  it('配额请求失败：fail-open 仍调 Worker', async () => {
    fetchHostedQuotaMock.mockRejectedValue(new Error('network_error'))
    const item = excerptWithEmbedding(
      '11111111-1111-4111-8111-111111111111',
      'manifest v3 service worker'
    )
    await fuseHybridMatches({
      displayClue: 'manifest v3',
      pairClue: 'manifest v3',
      items: [item],
      filterClue: 'manifest v3',
      parsed: parsedClue('manifest v3'),
      clueEmbeddingText: 'manifest v3 service worker',
      trace: createRecallFlowTrace('RecallFlow')
    })
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalled()
  })

  it('熔断开：Side Panel 三处均不调 requestWorkerEmbeddings（仍返回关键词结果）', async () => {
    tripEmbedQuotaBreaker(TOKEN)
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('manifest v3 service worker', {
      entry: 'sidepanel'
    })
    expect(requestWorkerEmbeddingsMock).not.toHaveBeenCalled()
    expect(fetchHostedQuotaMock).not.toHaveBeenCalled()
    // 关键词降级：有字面命中或诚实空；不得因熔断抛错
    expect(result.outcome === 'top_pick' || result.outcome === 'no_match').toBe(true)
  })

  it('Omnibox：不调 requestWorkerEmbeddings，也不发配额预查', async () => {
    const backend = new HybridRecallBackend()
    await backend.recallWithClue('manifest v3 service worker', { entry: 'omnibox' })
    expect(requestWorkerEmbeddingsMock).not.toHaveBeenCalled()
    expect(fetchHostedQuotaMock).not.toHaveBeenCalled()
  })
})
