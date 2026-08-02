import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/application/memory/schedule-async-memory-llm-enrichment', () => ({
  scheduleAsyncMemoryLlmEnrichment: vi.fn()
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    createBookmark: vi.fn(),
    createTextExcerpt: vi.fn(),
    upsertBookmarkFromChrome: vi.fn(),
    getByChromeBookmarkId: vi.fn()
  }
}))

import { MemoryItemService } from '@/application/memory/memory-item-service'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
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
        title: '新书签标题足够长',
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
        title: '新书签标题足够长',
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
        title: '改标题',
        url: 'https://example.com/n',
        chromeBookmarkId: 'cb-1'
      }
    })
    expect(scheduleAsyncMemoryLlmEnrichment).not.toHaveBeenCalled()
  })
})
