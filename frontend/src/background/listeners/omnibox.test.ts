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
  payload: {
    title: 'Retention analysis',
    url: 'https://example.com/retention',
    domain: 'example.com'
  },
  clues: {}
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
        getMessage: vi.fn((key: string) => {
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
      expect(suggest).toHaveBeenCalled()
    })

    expect(recallWithClueMock).toHaveBeenCalledWith('retention')
    expect(suggest.mock.calls[0]?.[0]?.[0]?.content).toBe(
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
    expect(recallWithClueMock).toHaveBeenCalledWith('retention')
    expect(recordOpenMock).toHaveBeenCalledWith(BOOKMARK_ID)
  })
})
