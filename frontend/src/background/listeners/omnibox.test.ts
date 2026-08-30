import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recallWithClueMock, recordOpenMock, getByIdMock } = vi.hoisted(() => ({
  recallWithClueMock: vi.fn(),
  recordOpenMock: vi.fn(async () => undefined),
  getByIdMock: vi.fn()
}))

vi.mock('@/application/recall/recall-service', () => ({
  recallService: {
    recallWithClue: recallWithClueMock
  }
}))

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    recordOpen: recordOpenMock,
    getById: getByIdMock
  }
}))

vi.mock('@/background/bootstrap', () => ({
  ensureBackgroundBootstrapped: vi.fn(async () => undefined)
}))

import {
  registerOmniboxListeners,
  resetOmniboxListenersForTests
} from '@/background/listeners/omnibox'

const BOOKMARK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const bookmarkItem = {
  id: BOOKMARK_ID,
  type: 'bookmark' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  payload: {
    title: 'Retention analysis',
    url: 'https://example.com/retention',
    domain: 'example.com'
  },
  clues: {
    keywords: [],
    tags: []
  }
}

describe('omnibox listeners', () => {
  const setDefaultSuggestion = vi.fn()
  const onInputChangedAddListener = vi.fn()
  const onInputEnteredAddListener = vi.fn()
  const tabsUpdate = vi.fn(async () => undefined)
  const tabsCreate = vi.fn(async () => undefined)

  beforeEach(() => {
    resetOmniboxListenersForTests()
    vi.clearAllMocks()
    getByIdMock.mockResolvedValue(bookmarkItem)

    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: vi.fn((key: string, ...args: string[]) => {
          if (key === 'omnibox_default_suggestion') {
            return 'Recall with Yiveno...'
          }
          if (key === 'omnibox_no_match') {
            return 'No matching memory found'
          }
          if (key === 'omnibox_type_bookmark') {
            return 'Y·Bookmark'
          }
          if (key === 'type_label_bookmark') {
            return 'Bookmark'
          }
          if (key === 'explain_field_short_title') {
            return 'title'
          }
          if (key === 'recall_card_saved_just_now') {
            return 'Just saved'
          }
          if (key === 'recall_card_saved') {
            return `Saved ${String(args?.[0] ?? '')}`
          }
          return ''
        })
      },
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://testid/${path}`)
      },
      omnibox: {
        setDefaultSuggestion,
        onInputChanged: { addListener: onInputChangedAddListener },
        onInputEntered: { addListener: onInputEnteredAddListener }
      },
      tabs: {
        update: tabsUpdate,
        create: tabsCreate
      }
    })
  })

  it('registerOmniboxListeners 只注册一次', () => {
    registerOmniboxListeners()
    registerOmniboxListeners()

    expect(setDefaultSuggestion).toHaveBeenCalledTimes(1)
    expect(onInputChangedAddListener).toHaveBeenCalledTimes(1)
    expect(onInputEnteredAddListener).toHaveBeenCalledTimes(1)
  })

  it('输入变化时用 recallService 提供建议', async () => {
    recallWithClueMock.mockResolvedValue({
      outcome: 'top_pick',
      topPick: {
        item: bookmarkItem,
        score: 40,
        matchedFields: ['title']
      },
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'retention'
    })

    registerOmniboxListeners()
    const onChanged = onInputChangedAddListener.mock.calls[0]?.[0] as (
      text: string,
      suggest: (results: chrome.omnibox.SuggestResult[]) => void
    ) => void

    const suggest = vi.fn()
    onChanged('retention', suggest)

    await vi.waitFor(() => {
      expect(recallWithClueMock).toHaveBeenCalledWith('retention', { entry: 'omnibox' })
    })

    expect(suggest.mock.calls[0]?.[0]).toEqual([])
    expect(suggest.mock.calls.at(-1)?.[0]?.[0]?.content).toBe(
      `chrome-extension://testid/omnibox-open.html?id=${BOOKMARK_ID}`
    )
  })

  it('新线索到达时先清空上一轮建议，且慢请求过期后不得回写旧结果', async () => {
    const chromeItem = {
      ...bookmarkItem,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      payload: {
        title: 'Migrate to Manifest V3',
        url: 'https://developer.chrome.com/docs/extensions/migrating/',
        domain: 'developer.chrome.com'
      }
    }
    const fontItem = {
      ...bookmarkItem,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      payload: {
        title: 'Font pairing ideas for editorial sites',
        url: 'https://www.typewolf.com/tips/font-pairing-editorial',
        domain: 'www.typewolf.com'
      }
    }

    let resolveChrome: ((value: unknown) => void) | undefined
    let resolveFont: ((value: unknown) => void) | undefined
    const chromeDeferred = new Promise(resolve => {
      resolveChrome = resolve
    })
    const fontDeferred = new Promise(resolve => {
      resolveFont = resolve
    })

    recallWithClueMock.mockImplementation((clue: string) => {
      if (clue === 'chrome extension migration') {
        return chromeDeferred
      }
      if (clue === 'font pairing editorial') {
        return fontDeferred
      }
      return Promise.resolve({
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue
      })
    })

    registerOmniboxListeners()
    const onChanged = onInputChangedAddListener.mock.calls[0]?.[0] as (
      text: string,
      suggest: (results: chrome.omnibox.SuggestResult[]) => void
    ) => void

    const chromeSuggest = vi.fn()
    onChanged('chrome extension migration', chromeSuggest)

    await vi.waitFor(() => {
      expect(chromeSuggest).toHaveBeenCalledWith([])
      expect(recallWithClueMock).toHaveBeenCalledWith('chrome extension migration', {
        entry: 'omnibox'
      })
    })

    const fontSuggest = vi.fn()
    onChanged('font pairing editorial', fontSuggest)

    await vi.waitFor(() => {
      expect(fontSuggest).toHaveBeenCalledWith([])
    })

    resolveFont?.({
      outcome: 'top_pick',
      topPick: {
        item: fontItem,
        score: 40,
        matchedFields: ['title']
      },
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'font pairing editorial'
    })

    await vi.waitFor(() => {
      expect(fontSuggest.mock.calls.at(-1)?.[0]?.[0]?.content).toBe(
        `chrome-extension://testid/omnibox-open.html?id=${fontItem.id}`
      )
    })

    resolveChrome?.({
      outcome: 'top_pick',
      topPick: {
        item: chromeItem,
        score: 40,
        matchedFields: ['title']
      },
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'chrome extension migration'
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(chromeSuggest).toHaveBeenCalledTimes(1)
    expect(chromeSuggest).toHaveBeenCalledWith([])
    expect(fontSuggest.mock.calls.at(-1)?.[0]?.[0]?.content).toBe(
      `chrome-extension://testid/omnibox-open.html?id=${fontItem.id}`
    )
  })

  it('过期请求失败时不得清空当前建议', async () => {
    let rejectSlow: ((reason?: unknown) => void) | undefined
    const slowDeferred = new Promise((_resolve, reject) => {
      rejectSlow = reject
    })

    recallWithClueMock.mockImplementation((clue: string) => {
      if (clue === 'chrome extension migration') {
        return slowDeferred
      }
      return Promise.resolve({
        outcome: 'top_pick',
        topPick: {
          item: bookmarkItem,
          score: 40,
          matchedFields: ['title']
        },
        alsoPossible: [],
        totalRankedCount: 0,
        clue
      })
    })

    registerOmniboxListeners()
    const onChanged = onInputChangedAddListener.mock.calls[0]?.[0] as (
      text: string,
      suggest: (results: chrome.omnibox.SuggestResult[]) => void
    ) => void

    const chromeSuggest = vi.fn()
    onChanged('chrome extension migration', chromeSuggest)

    await vi.waitFor(() => {
      expect(recallWithClueMock).toHaveBeenCalledWith('chrome extension migration', {
        entry: 'omnibox'
      })
    })

    const fontSuggest = vi.fn()
    onChanged('retention', fontSuggest)

    await vi.waitFor(() => {
      expect(recallWithClueMock).toHaveBeenCalledWith('retention', { entry: 'omnibox' })
    })

    await vi.waitFor(() => {
      expect(fontSuggest.mock.calls.at(-1)?.[0]?.[0]?.content).toBe(
        `chrome-extension://testid/omnibox-open.html?id=${BOOKMARK_ID}`
      )
    })

    rejectSlow?.(new Error('stale recall failed'))

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(chromeSuggest).toHaveBeenCalledTimes(1)
    expect(chromeSuggest).toHaveBeenCalledWith([])
    expect(fontSuggest.mock.calls.at(-1)?.[0]?.[0]?.content).toBe(
      `chrome-extension://testid/omnibox-open.html?id=${BOOKMARK_ID}`
    )
  })

  it('选中书签占位建议时写回并打开真实 URL', async () => {
    registerOmniboxListeners()
    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void

    onEntered(`chrome-extension://testid/omnibox-open.html?id=${BOOKMARK_ID}`, 'currentTab')

    await vi.waitFor(() => {
      expect(tabsUpdate).toHaveBeenCalledWith({ url: 'https://example.com/retention' })
    })
    expect(recordOpenMock).toHaveBeenCalledWith(BOOKMARK_ID)
    expect(getByIdMock).toHaveBeenCalledWith(BOOKMARK_ID)
  })

  it('选中 http 直链建议仍按 disposition 打开', async () => {
    registerOmniboxListeners()
    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void

    onEntered('https://example.com/retention', 'currentTab')

    await vi.waitFor(() => {
      expect(tabsUpdate).toHaveBeenCalledWith({ url: 'https://example.com/retention' })
    })
    expect(recordOpenMock).not.toHaveBeenCalled()
  })

  it('直接回车对线索再 Recall 并打开 Top Pick', async () => {
    recallWithClueMock.mockResolvedValue({
      outcome: 'top_pick',
      topPick: {
        item: bookmarkItem,
        score: 40,
        matchedFields: ['title']
      },
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'retention'
    })

    registerOmniboxListeners()
    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void

    onEntered('retention', 'newForegroundTab')

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://example.com/retention' })
    })
    expect(recallWithClueMock).toHaveBeenCalledWith('retention', { entry: 'omnibox' })
    expect(recordOpenMock).toHaveBeenCalledWith(BOOKMARK_ID)
  })
})
