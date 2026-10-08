import { beforeEach, describe, expect, it, vi } from 'vitest'

const { understandRecallClueMock, getClueLlmCompleterMock, requestWorkerEmbeddingsMock } =
  vi.hoisted(() => ({
    understandRecallClueMock: vi.fn(),
    getClueLlmCompleterMock: vi.fn(),
    requestWorkerEmbeddingsMock: vi.fn()
  }))

vi.mock('@/core/recall/understand/understand-recall-clue', () => ({
  understandRecallClue: understandRecallClueMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: getClueLlmCompleterMock
}))

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    listForKeywordRecall: vi.fn(async () => ({ items: [], source: 'scan' as const }))
  }
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: vi.fn(async () => null)
}))

vi.mock('@/application/recall/apply-stored-outcome-pairs', () => ({
  applyStoredOutcomePairsToMatches: vi.fn(async (matches: unknown[]) => matches)
}))

vi.mock('@/infrastructure/ai/embed-api-client', () => ({
  requestWorkerEmbeddings: requestWorkerEmbeddingsMock
}))

import { HybridRecallBackend } from '@/application/recall/backends/hybrid-recall-backend'

describe('HybridRecallBackend · entry omnibox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getClueLlmCompleterMock.mockReturnValue(vi.fn())
    understandRecallClueMock.mockResolvedValue({
      disposition: 'proceed',
      rejectReason: null,
      mode: 'lexical',
      source: 'rules',
      parsed: {
        raw: 'Manifest V3',
        contentTerms: ['manifest', 'v3'],
        confidence: 'high'
      },
      filterClue: 'manifest v3'
    })
  })

  it('Omnibox 入口：强制 lexical 规则理解，不注入 LLM completer', async () => {
    const backend = new HybridRecallBackend()
    await backend.recallWithClue('Manifest V3', { entry: 'omnibox' })

    expect(understandRecallClueMock).toHaveBeenCalledWith(
      'Manifest V3',
      expect.objectContaining({
        forceMode: 'lexical'
      })
    )
    const call = understandRecallClueMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(call.complete).toBeUndefined()
  })

  it('Side Panel 入口：有 completer 时传入理解层', async () => {
    const completer = vi.fn()
    getClueLlmCompleterMock.mockReturnValue(completer)

    const backend = new HybridRecallBackend()
    await backend.recallWithClue('Manifest V3', { entry: 'sidepanel' })

    expect(understandRecallClueMock).toHaveBeenCalledWith(
      'Manifest V3',
      expect.objectContaining({
        complete: completer
      })
    )
    const call = understandRecallClueMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(call.forceMode).toBeUndefined()
  })

  // ADR-007：Omnibox = 已知锚点快跳，禁止向量融合（clue embed / Topic embed）。
  // 防止未来有人误在 Omnibox 入口接回 requestWorkerEmbeddings。
  it('Omnibox 入口：不调向量嵌入（requestWorkerEmbeddings 调用次数为 0）', async () => {
    const backend = new HybridRecallBackend()
    await backend.recallWithClue('Manifest V3', { entry: 'omnibox' })

    expect(requestWorkerEmbeddingsMock).not.toHaveBeenCalled()
  })
})
