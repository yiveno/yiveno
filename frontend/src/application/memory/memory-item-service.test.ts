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
import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
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

  it('upsertBookmarkFromChrome 不调度 AI（与 bulk 一致，防万级书签刷配额）', async () => {
    const created = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        title: 'A long enough new bookmark title',
        url: 'https://example.com/n',
        chromeBookmarkId: 'cb-1'
      }
    })
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
    expect(scheduleAsyncMemoryLlmEnrichment).not.toHaveBeenCalled()
    expect(scheduleAsyncMemoryEmbedding).not.toHaveBeenCalled()
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

  it('倒排返回空 id 时降级全表扫，避免假 no_match', async () => {
    const bookmark = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'The Million Pound Note', url: 'https://example.com/m' }
    })
    vi.mocked(keywordIndexRepository.lookupCandidateIds).mockResolvedValue({
      ids: [],
      rebuilt: false
    })
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([bookmark])
    const service = new MemoryItemService(memoryItemRepository)
    const parsed = parseRecallClue('Million Pound Note')

    const result = await service.listForKeywordRecall({
      rawClue: 'Million Pound Note',
      parsed
    })

    expect(result.source).toBe('scan')
    expect(result.items).toEqual([bookmark])
    expect(memoryItemRepository.listByOwner).toHaveBeenCalled()
  })

  it('倒排 id 读回空列表时也降级全表扫', async () => {
    const bookmark = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Oppenheimer', url: 'https://example.com/o' }
    })
    vi.mocked(keywordIndexRepository.lookupCandidateIds).mockResolvedValue({
      ids: ['11111111-1111-4111-8111-111111111117'],
      rebuilt: false
    })
    vi.mocked(memoryItemRepository.getManyByIds).mockResolvedValue([])
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([bookmark])
    const service = new MemoryItemService(memoryItemRepository)
    const parsed = parseRecallClue('Oppenheimer')

    const result = await service.listForKeywordRecall({
      rawClue: 'Oppenheimer',
      parsed
    })

    expect(result.source).toBe('scan')
    expect(result.items).toEqual([bookmark])
  })

  it('倒排候选并入摘录，避免 posting 漏摘录导致假 no_match', async () => {
    const bookmark = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Unrelated bookmark', url: 'https://example.com/u' }
    })
    const excerpt = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText:
          'The Million Pound Note (1954) is a classic Gregory Peck comedy about a man handed a banknote he cannot spend.',
        sourceUrl: 'https://en.wikipedia.org/wiki/The_Million_Pound_Note',
        pageTitle: 'The Million Pound Note - Wikipedia'
      }
    })
    vi.mocked(keywordIndexRepository.lookupCandidateIds).mockResolvedValue({
      ids: [bookmark.id],
      rebuilt: false
    })
    vi.mocked(memoryItemRepository.getManyByIds).mockResolvedValue([bookmark])
    vi.mocked(memoryItemRepository.listByOwner).mockImplementation(async options => {
      if (options?.type === 'text_excerpt') {
        return [excerpt]
      }
      return []
    })
    const service = new MemoryItemService(memoryItemRepository)
    const parsed = parseRecallClue('Gregory Peck million pound note 1954')

    const result = await service.listForKeywordRecall({
      rawClue: 'Gregory Peck million pound note 1954',
      parsed
    })

    expect(result.source).toBe('inverted')
    expect(result.items.map(item => item.id)).toEqual([excerpt.id, bookmark.id])
  })

  it('倒排有 id 但关键词探针无命中时降级全表扫', async () => {
    const wrongBookmark = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'NotebookLM', url: 'https://notebooklm.google.com' }
    })
    const excerpt = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText:
          'The Million Pound Note (1954) is a classic Gregory Peck comedy about a man handed a banknote he cannot spend.',
        sourceUrl: 'https://en.wikipedia.org/wiki/The_Million_Pound_Note',
        pageTitle: 'The Million Pound Note - Wikipedia'
      }
    })
    vi.mocked(keywordIndexRepository.lookupCandidateIds).mockResolvedValue({
      ids: [wrongBookmark.id],
      rebuilt: false
    })
    vi.mocked(memoryItemRepository.getManyByIds).mockResolvedValue([wrongBookmark])
    vi.mocked(memoryItemRepository.listByOwner).mockImplementation(async options => {
      if (options?.type === 'text_excerpt') {
        return []
      }
      return [excerpt, wrongBookmark]
    })
    const service = new MemoryItemService(memoryItemRepository)
    const parsed = parseRecallClue('Gregory Peck million pound note 1954')

    const result = await service.listForKeywordRecall({
      rawClue: 'Gregory Peck million pound note 1954',
      parsed
    })

    expect(result.source).toBe('scan')
    expect(result.items.map(item => item.id)).toEqual([excerpt.id, wrongBookmark.id])
  })

  it('全表扫时并入摘录，避免海量书签挤掉 excerpt 候选', async () => {
    const bookmarks = Array.from({ length: 3 }, (_, index) =>
      createBookmarkMemoryItem({
        ownerId: 'o',
        sourceLocalProfileId: 'p',
        payload: { title: `Bookmark ${index}`, url: `https://example.com/b${index}` }
      })
    )
    const excerpt = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText:
          'The Million Pound Note (1954) is a classic Gregory Peck comedy about a man handed a banknote he cannot spend.',
        sourceUrl: 'https://en.wikipedia.org/wiki/The_Million_Pound_Note',
        pageTitle: 'The Million Pound Note - Wikipedia'
      }
    })
    vi.mocked(keywordIndexRepository.lookupCandidateIds).mockResolvedValue({
      ids: [],
      rebuilt: false
    })
    vi.mocked(memoryItemRepository.listByOwner).mockImplementation(async options => {
      if (options?.type === 'text_excerpt') {
        return [excerpt]
      }
      return bookmarks
    })
    const service = new MemoryItemService(memoryItemRepository)
    const parsed = parseRecallClue('Gregory Peck million pound note 1954')

    const result = await service.listForKeywordRecall({
      rawClue: 'Gregory Peck million pound note 1954',
      parsed
    })

    expect(result.source).toBe('scan')
    expect(result.items[0]?.id).toBe(excerpt.id)
    expect(result.items.map(item => item.id)).toEqual([
      excerpt.id,
      bookmarks[0]?.id,
      bookmarks[1]?.id,
      bookmarks[2]?.id
    ])
  })
})
