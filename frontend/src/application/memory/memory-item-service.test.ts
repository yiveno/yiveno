import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/application/memory/schedule-async-memory-llm-enrichment', () => ({
  scheduleAsyncMemoryLlmEnrichment: vi.fn()
}))

vi.mock('@/application/memory/schedule-async-memory-embedding', () => ({
  scheduleAsyncMemoryEmbedding: vi.fn()
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    createBookmark: vi.fn(),
    createTextExcerpt: vi.fn(),
    upsertBookmarkFromChrome: vi.fn(),
    getByChromeBookmarkId: vi.fn(),
    listByOwner: vi.fn(),
    getManyByIds: vi.fn()
  }
}))

vi.mock('@/infrastructure/indexeddb/keyword-index-repository', () => ({
  keywordIndexRepository: {
    lookupCandidateIds: vi.fn()
  }
}))

import { MemoryItemService } from '@/application/memory/memory-item-service'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

describe('MemoryItemService LLM enrichment 调度', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('captureTextExcerpt 落库后调度异步 enrichment', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'excerpt-like', url: 'https://example.com/e' }
    })
    vi.mocked(memoryItemRepository.createTextExcerpt).mockResolvedValue(item as never)
    const service = new MemoryItemService(memoryItemRepository)
    await service.captureTextExcerpt({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: 'hello world text',
        sourceUrl: 'https://example.com/e'
      }
    } as never)

    expect(scheduleAsyncMemoryLlmEnrichment).toHaveBeenCalledWith(item.id)
  })

  it('upsertBookmarkFromChrome 仅新建时调度', async () => {
    const created = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        title: 'A long enough new bookmark title',
        url: 'https://example.com/n',
        chromeBookmarkId: 'cb-1'
      }
    })
    vi.mocked(memoryItemRepository.getByChromeBookmarkId).mockResolvedValue(null)
    vi.mocked(memoryItemRepository.upsertBookmarkFromChrome).mockResolvedValue(created)

    const service = new MemoryItemService(memoryItemRepository)
    await service.upsertBookmarkFromChrome({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        title: 'A long enough new bookmark title',
        url: 'https://example.com/n',
        chromeBookmarkId: 'cb-1'
      }
    })
    expect(scheduleAsyncMemoryLlmEnrichment).toHaveBeenCalledWith(created.id)

    vi.mocked(scheduleAsyncMemoryLlmEnrichment).mockClear()
    vi.mocked(memoryItemRepository.getByChromeBookmarkId).mockResolvedValue(created)
    await service.upsertBookmarkFromChrome({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        title: 'Updated title',
        url: 'https://example.com/n',
        chromeBookmarkId: 'cb-1'
      }
    })
    expect(scheduleAsyncMemoryLlmEnrichment).not.toHaveBeenCalled()
  })
})

describe('MemoryItemService listForKeywordRecall', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('约束邻域线索跳过倒排，直接全表扫', async () => {
    const bookmark = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Interview on X', url: 'https://x.com/a' }
    })
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([bookmark])
    const service = new MemoryItemService(memoryItemRepository)

    for (const clue of ['just saved bookmark', 'just saved']) {
      vi.mocked(keywordIndexRepository.lookupCandidateIds).mockClear()
      const parsed = parseRecallClue(clue)
      const result = await service.listForKeywordRecall({ rawClue: clue, parsed })
      expect(result.source).toBe('scan')
      expect(result.items).toEqual([bookmark])
      expect(keywordIndexRepository.lookupCandidateIds).not.toHaveBeenCalled()
    }
  })
})
