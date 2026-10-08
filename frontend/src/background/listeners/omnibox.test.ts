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

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/browser/navigate-tab', () => ({
  navigateTabToUrl: vi.fn(async () => undefined)
}))

const { writeRecallPrefillMock, openRecallSidePanelMock } = vi.hoisted(() => ({
  writeRecallPrefillMock: vi.fn(async () => undefined),
  openRecallSidePanelMock: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/storage/first-recall-onboarding-storage', () => ({
  writeRecallPrefill: writeRecallPrefillMock
}))

vi.mock('@/infrastructure/browser/side-panel', () => ({
  openRecallSidePanel: openRecallSidePanelMock
}))

import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
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
  const tabsCreate = vi.fn(async () => undefined)
  const commandsGetAll = vi.fn(async () => [{ name: '_execute_action', shortcut: 'Alt+Shift+Y' }])

  beforeEach(() => {
    resetOmniboxListenersForTests()
    vi.clearAllMocks()
    getByIdMock.mockResolvedValue(bookmarkItem)
    commandsGetAll.mockResolvedValue([{ name: '_execute_action', shortcut: 'Alt+Shift+Y' }])

    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: vi.fn((key: string, substitutions?: string | string[]) => {
          const sub =
            substitutions === undefined
              ? ''
              : Array.isArray(substitutions)
                ? (substitutions[0] ?? '')
                : substitutions
          if (key === 'omnibox_default_suggestion') {
            return 'Tip: Title, site, or note keyword. Fuzzy → Side Panel'
          }
          if (key === 'omnibox_default_suggestion_with_shortcut') {
            return `Tip: Title, site, or note keyword. Fuzzy → Side Panel (${sub})`
          }
          if (key === 'omnibox_no_match') {
            return 'No quick match — open Side Panel to recall this'
          }
          if (key === 'omnibox_no_match_with_shortcut') {
            return `No quick match — open Side Panel to recall this (${sub})`
          }
          if (key === 'omnibox_switch_track') {
            return 'Not what you wanted? Open Side Panel'
          }
          if (key === 'omnibox_switch_track_with_shortcut') {
            return `Not what you wanted? Open Side Panel (${sub})`
          }
          if (key === 'omnibox_type_bookmark') {
            return 'Bookmark'
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
            const arg = Array.isArray(substitutions) ? substitutions[0] : substitutions
            return `Saved ${String(arg ?? '')}`
          }
          return ''
        })
      },
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://testid/${path}`)
      },
      commands: {
        getAll: commandsGetAll
      },
      omnibox: {
        setDefaultSuggestion,
        onInputChanged: { addListener: onInputChangedAddListener },
        onInputEntered: { addListener: onInputEnteredAddListener }
      },
      tabs: {
        create: tabsCreate
      }
    })
  })

  it('registerOmniboxListeners 只注册一次', async () => {
    registerOmniboxListeners()
    registerOmniboxListeners()

    expect(onInputChangedAddListener).toHaveBeenCalledTimes(1)
    expect(onInputEnteredAddListener).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(setDefaultSuggestion).toHaveBeenCalledTimes(1)
    })
    expect(setDefaultSuggestion).toHaveBeenCalledWith({
      description: 'Tip: Title, site, or note keyword. Fuzzy → Side Panel (Alt+Shift+Y)'
    })
  })

  it('default suggestion 使用 commands.getAll 真实快捷键；未绑定则省略', async () => {
    commandsGetAll.mockResolvedValue([{ name: '_execute_action', shortcut: 'Ctrl+Shift+Y' }])
    registerOmniboxListeners()
    await vi.waitFor(() => {
      expect(setDefaultSuggestion).toHaveBeenCalledWith({
        description: 'Tip: Title, site, or note keyword. Fuzzy → Side Panel (Ctrl+Shift+Y)'
      })
    })

    resetOmniboxListenersForTests()
    setDefaultSuggestion.mockClear()
    commandsGetAll.mockResolvedValue([{ name: '_execute_action', shortcut: '' }])
    registerOmniboxListeners()
    await vi.waitFor(() => {
      expect(setDefaultSuggestion).toHaveBeenCalledWith({
        description: 'Tip: Title, site, or note keyword. Fuzzy → Side Panel'
      })
    })
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

    // suggest 只应调用一次（禁止异步前 suggest([]) 吃掉 one-shot 回调）
    expect(suggest).toHaveBeenCalledTimes(1)
    const rows = suggest.mock.calls[0]?.[0] as chrome.omnibox.SuggestResult[]
    expect(rows).toHaveLength(2)
    expect(rows[0]?.content).toBe(`chrome-extension://testid/omnibox-open.html?id=${BOOKMARK_ID}`)
    expect(rows[1]?.content).toMatch(/^yiveno-omnibox-handoff:/)
    expect(rows[1]?.description).toContain('Not what you wanted')
  })

  it('慢请求过期后不得回写旧结果（suggest 不抢先清空）', async () => {
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
      expect(recallWithClueMock).toHaveBeenCalledWith('chrome extension migration', {
        entry: 'omnibox'
      })
    })

    const fontSuggest = vi.fn()
    onChanged('font pairing editorial', fontSuggest)

    await vi.waitFor(() => {
      expect(recallWithClueMock).toHaveBeenCalledWith('font pairing editorial', {
        entry: 'omnibox'
      })
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
      expect(fontSuggest).toHaveBeenCalledTimes(1)
      expect(fontSuggest.mock.calls[0]?.[0]?.[0]?.content).toBe(
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

    // 过期请求不得再 suggest（含不得抢先 suggest([])）
    expect(chromeSuggest).toHaveBeenCalledTimes(0)
    expect(fontSuggest).toHaveBeenCalledTimes(1)
    expect(fontSuggest.mock.calls[0]?.[0]?.[0]?.content).toBe(
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

    // 过期失败不得 suggest([])，以免吃掉 / 干扰当前键位的建议回调语义
    expect(chromeSuggest).toHaveBeenCalledTimes(0)
    expect(fontSuggest).toHaveBeenCalledTimes(1)
    expect(fontSuggest.mock.calls[0]?.[0]?.[0]?.content).toBe(
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
      expect(navigateTabToUrl).toHaveBeenCalledWith('https://example.com/retention', 'currentTab')
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
      expect(navigateTabToUrl).toHaveBeenCalledWith('https://example.com/retention', 'currentTab')
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
      expect(navigateTabToUrl).toHaveBeenCalledWith(
        'https://example.com/retention',
        'newForegroundTab'
      )
    })
    expect(recallWithClueMock).toHaveBeenCalledWith('retention', { entry: 'omnibox' })
    expect(recordOpenMock).toHaveBeenCalledWith(BOOKMARK_ID)
    expect(writeRecallPrefillMock).not.toHaveBeenCalled()
    expect(openRecallSidePanelMock).not.toHaveBeenCalled()
  })

  it('无快跳命中时回车：写 prefill 并打开 Side Panel', async () => {
    recallWithClueMock.mockResolvedValue({
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'zzzz-no-match'
    })

    registerOmniboxListeners()
    const onChanged = onInputChangedAddListener.mock.calls[0]?.[0] as (
      text: string,
      suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void
    ) => void
    const suggest = vi.fn()
    onChanged('zzzz-no-match', suggest)
    await vi.waitFor(() => {
      expect(suggest).toHaveBeenCalled()
    })
    const handoffSuggest = suggest.mock.calls[0]?.[0] as chrome.omnibox.SuggestResult[]
    expect(handoffSuggest).toHaveLength(1)
    expect(handoffSuggest[0]?.content).toMatch(/^yiveno-omnibox-handoff:/)

    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void
    const recallCallsBeforeEnter = recallWithClueMock.mock.calls.length
    // 点可选行：content 为 handoff token（比仅 default 行更稳）
    onEntered(handoffSuggest[0]!.content, 'currentTab')

    await vi.waitFor(() => {
      expect(writeRecallPrefillMock).toHaveBeenCalledWith('zzzz-no-match')
      expect(openRecallSidePanelMock).toHaveBeenCalled()
    })
    // handoff content 路径不二次 Offline lookup
    expect(recallWithClueMock.mock.calls.length).toBe(recallCallsBeforeEnter)
    expect(navigateTabToUrl).not.toHaveBeenCalled()
  })

  it('无命中时默认行回车（线索字面）不接力，须点 CTA 行', async () => {
    recallWithClueMock.mockResolvedValue({
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'plain-clue'
    })

    registerOmniboxListeners()
    const onChanged = onInputChangedAddListener.mock.calls[0]?.[0] as (
      text: string,
      suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void
    ) => void
    onChanged('plain-clue', vi.fn())
    await vi.waitFor(() => {
      expect(recallWithClueMock).toHaveBeenCalled()
    })

    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void
    onEntered('plain-clue', 'currentTab')

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(writeRecallPrefillMock).not.toHaveBeenCalled()
    expect(openRecallSidePanelMock).not.toHaveBeenCalled()
    expect(navigateTabToUrl).not.toHaveBeenCalled()
  })

  it('inputEntered http 直链不强制 bootstrap（无 Memory 解析）', async () => {
    registerOmniboxListeners()
    const onEntered = onInputEnteredAddListener.mock.calls[0]?.[0] as (
      text: string,
      disposition: chrome.omnibox.OnInputEnteredDisposition
    ) => void

    onEntered('https://example.com/retention', 'currentTab')

    await vi.waitFor(() => {
      expect(navigateTabToUrl).toHaveBeenCalledWith('https://example.com/retention', 'currentTab')
    })
  })
})
