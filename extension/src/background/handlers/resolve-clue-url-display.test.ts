import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: vi.fn(async () => 'owner-test')
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listAllByOwnerId: vi.fn()
  }
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: vi.fn(() => 0),
  flowOk: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import {
  clearClueUrlDisplayLibraryCacheForTests,
  handleResolveClueUrlDisplay
} from '@/background/handlers/resolve-clue-url-display'

describe('handleResolveClueUrlDisplay', () => {
  beforeEach(() => {
    clearClueUrlDisplayLibraryCacheForTests()
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn(async () => [])
      }
    })
  })

  it('库内书签标题优先', async () => {
    vi.mocked(memoryItemRepository.listAllByOwnerId).mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000001',
        type: 'bookmark',
        ownerId: 'owner-test',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        payload: {
          title: 'Hydration reaction - Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Hydration_reaction'
        }
      } as never
    ])

    const result = await handleResolveClueUrlDisplay({
      urls: ['https://www.en.wikipedia.org/wiki/Hydration_reaction']
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.entries[0]?.source).toBe('library')
    expect(result.entries[0]?.title).toContain('Hydration')
  })

  it('库未命中时用打开中的 tab 标题', async () => {
    vi.mocked(memoryItemRepository.listAllByOwnerId).mockResolvedValue([])
    const queryMock = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>
    queryMock.mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com/doc',
        title: 'Example Doc Title'
      }
    ])

    const result = await handleResolveClueUrlDisplay({
      urls: ['https://example.com/doc']
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.entries[0]).toEqual({
      url: 'https://example.com/doc',
      title: 'Example Doc Title',
      source: 'tab'
    })
  })

  it('都未命中 → none', async () => {
    vi.mocked(memoryItemRepository.listAllByOwnerId).mockResolvedValue([])
    const result = await handleResolveClueUrlDisplay({
      urls: ['https://no-match.example/x']
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.entries[0]?.source).toBe('none')
    expect(result.entries[0]?.title).toBeNull()
  })
})
