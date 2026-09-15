import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requestGettingStartedClueSamplesMock,
  getUserSettingsMock,
  readGsClueSamplesCacheMock,
  writeGsClueSamplesCacheMock
} = vi.hoisted(() => ({
  requestGettingStartedClueSamplesMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  readGsClueSamplesCacheMock: vi.fn(),
  writeGsClueSamplesCacheMock: vi.fn()
}))

vi.mock('@/infrastructure/ai/gs-clue-samples-api-client', () => ({
  requestGettingStartedClueSamples: requestGettingStartedClueSamplesMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock
}))

vi.mock('@/infrastructure/storage/gs-clue-samples-storage', async () => {
  const actual = await vi.importActual<
    typeof import('@/infrastructure/storage/gs-clue-samples-storage')
  >('@/infrastructure/storage/gs-clue-samples-storage')
  return {
    ...actual,
    readGsClueSamplesCache: readGsClueSamplesCacheMock,
    writeGsClueSamplesCache: writeGsClueSamplesCacheMock
  }
})

import { generateGettingStartedClueSamples } from '@/application/onboarding/generate-getting-started-clue-samples'
import type { BookmarkLibraryIndexNode } from '@/core/memory/bookmark-library-index'

function bookmark(
  partial: Partial<BookmarkLibraryIndexNode> & { chromeId: string; title: string }
): BookmarkLibraryIndexNode {
  return {
    parentId: null,
    kind: 'bookmark',
    hasNote: false,
    childIds: [],
    ...partial
  }
}

describe('generateGettingStartedClueSamples', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readGsClueSamplesCacheMock.mockResolvedValue(null)
    writeGsClueSamplesCacheMock.mockResolvedValue(undefined)
    getUserSettingsMock.mockResolvedValue({ aiFeaturesEnabled: true })
  })

  it('缓存命中不二次请求 LLM', async () => {
    readGsClueSamplesCacheMock.mockResolvedValue({
      cacheKey: 'c1|hello|https://x.test',
      title: 'Hello',
      url: 'https://x.test',
      clues: ['a', 'b', 'c', 'd'],
      origin: 'llm'
    })
    const result = await generateGettingStartedClueSamples({
      nodes: [
        bookmark({
          chromeId: 'c1',
          title: 'Hello',
          url: 'https://x.test',
          savedAt: '2026-09-14T00:00:00.000Z'
        })
      ],
      fallbackClue: 'fallback'
    })
    expect(result?.fromCache).toBe(true)
    expect(result?.origin).toBe('llm')
    expect(requestGettingStartedClueSamplesMock).not.toHaveBeenCalled()
  })

  it('关 AI → 模板回退且不打网', async () => {
    getUserSettingsMock.mockResolvedValue({ aiFeaturesEnabled: false })
    const result = await generateGettingStartedClueSamples({
      nodes: [
        bookmark({
          chromeId: 'c1',
          title: 'Cloud retention policy',
          url: 'https://x.test',
          savedAt: '2026-09-14T00:00:00.000Z'
        })
      ],
      fallbackClue: 'fallback'
    })
    expect(requestGettingStartedClueSamplesMock).not.toHaveBeenCalled()
    expect(result?.origin).toBe('template')
    expect(result?.clues[0]).toContain('Cloud retention policy')
    expect(writeGsClueSamplesCacheMock).toHaveBeenCalled()
  })

  it('LLM 失败 → 模板回退', async () => {
    requestGettingStartedClueSamplesMock.mockRejectedValue(new Error('quota_exceeded'))
    const result = await generateGettingStartedClueSamples({
      nodes: [
        bookmark({
          chromeId: 'c1',
          title: 'RACI spring ops',
          url: 'https://x.test',
          savedAt: '2026-09-14T00:00:00.000Z'
        })
      ],
      fallbackClue: 'fallback'
    })
    expect(result?.origin).toBe('template')
    expect(result?.clues.length).toBeGreaterThan(0)
  })
})
