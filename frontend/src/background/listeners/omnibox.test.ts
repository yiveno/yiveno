import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recallWithClueMock } = vi.hoisted(() => ({
  recallWithClueMock: vi.fn()
}))

vi.mock('@/application/recall/recall-service', () => ({
  recallService: {
    recallWithClue: recallWithClueMock
  }
}))

vi.mock('@/background/bootstrap', () => ({
  ensureBackgroundBootstrapped: vi.fn(async () => undefined)
}))

import {
  registerOmniboxListeners,
  resetOmniboxListenersForTests
} from '@/background/listeners/omnibox'

describe('omnibox listeners', () => {
  const setDefaultSuggestion = vi.fn()
  const onInputChangedAddListener = vi.fn()
  const onInputEnteredAddListener = vi.fn()
  const tabsUpdate = vi.fn(async () => undefined)
  const tabsCreate = vi.fn(async () => undefined)

  beforeEach(() => {
    resetOmniboxListenersForTests()
    vi.clearAllMocks()

    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: vi.fn((key: string) => {
          if (key === 'omnibox_default_suggestion') {
            return '在 Yiveno 中找回…'
          }
          if (key === 'omnibox_no_match') {
            return '未找到匹配的记忆'
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
        item: {
          type: 'bookmark',
          payload: {
            title: '留存分析',
            url: 'https://example.com/retention',
            domain: 'example.com'
          },
          clues: {}
        },
        score: 40,
        matchedFields: ['title']
      },
      alsoPossible: [],
      clue: '留存'
    })

    registerOmniboxListeners()
    const onChanged = onInputChangedAddListener.mock.calls[0]?.[0] as (
      text: string,
      suggest: (results: chrome.omnibox.SuggestResult[]) => void
    ) => void

    const suggest = vi.fn()
    onChanged('留存', suggest)

    await vi.waitFor(() => {
      expect(suggest).toHaveBeenCalled()
    })

    expect(recallWithClueMock).toHaveBeenCalledWith('留存')
    expect(suggest.mock.calls[0]?.[0]?.[0]?.content).toBe('https://example.com/retention')
  })

  it('选中建议按 disposition 打开 URL', async () => {
    registerOmniboxListeners()
    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void

    onEntered('https://example.com/retention', 'currentTab')

    await vi.waitFor(() => {
      expect(tabsUpdate).toHaveBeenCalledWith({ url: 'https://example.com/retention' })
    })
  })

  it('直接回车对线索再 Recall 并打开 Top Pick', async () => {
    recallWithClueMock.mockResolvedValue({
      outcome: 'top_pick',
      topPick: {
        item: {
          type: 'bookmark',
          payload: {
            title: '留存分析',
            url: 'https://example.com/retention',
            domain: 'example.com'
          }
        },
        score: 40,
        matchedFields: ['title']
      },
      alsoPossible: [],
      clue: '留存'
    })

    registerOmniboxListeners()
    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void

    onEntered('留存', 'newForegroundTab')

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://example.com/retention' })
    })
    expect(recallWithClueMock).toHaveBeenCalledWith('留存')
  })
})
