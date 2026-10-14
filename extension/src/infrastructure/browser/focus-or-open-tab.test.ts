import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  focusOrOpenTab,
  isSameOriginPathTabUrl,
  normalizeUrlPathname
} from '@/infrastructure/browser/focus-or-open-tab'
import { createMockTabsCreate, createMockTabsQuery } from '@/tests/chrome-mock'

describe('normalizeUrlPathname / isSameOriginPathTabUrl', () => {
  it('normalizeUrlPathname 去尾斜杠', () => {
    expect(normalizeUrlPathname('/login/')).toBe('/login')
    expect(normalizeUrlPathname('/')).toBe('/')
    expect(normalizeUrlPathname('account')).toBe('/account')
  })

  it('同 origin + path 匹配忽略 query', () => {
    expect(
      isSameOriginPathTabUrl(
        'http://localhost:3001/login?connect_extension=1',
        'http://localhost:3001',
        '/login'
      )
    ).toBe(true)
    expect(
      isSameOriginPathTabUrl('http://localhost:3001/account', 'http://localhost:3001', '/login')
    ).toBe(false)
    expect(
      isSameOriginPathTabUrl('https://other.example/login', 'http://localhost:3001', '/login')
    ).toBe(false)
  })
})

describe('focusOrOpenTab', () => {
  const tabsQuery = createMockTabsQuery()
  const tabsCreate = createMockTabsCreate()
  const tabsUpdate = vi.fn(async () => undefined)
  const windowsUpdate = vi.fn(async () => undefined)
  const sessionGet = vi.fn(async () => ({}))
  const sessionSet = vi.fn(async () => undefined)
  const sessionRemove = vi.fn(async () => undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    tabsQuery.mockResolvedValue([])
    tabsCreate.mockResolvedValue({ id: 99, windowId: 4 } as chrome.tabs.Tab)
    sessionGet.mockResolvedValue({})

    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: sessionGet,
          set: sessionSet,
          remove: sessionRemove
        }
      },
      tabs: {
        query: tabsQuery,
        get: vi.fn(),
        update: tabsUpdate,
        create: tabsCreate
      },
      windows: {
        update: windowsUpdate
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('urlPatterns 命中则激活且不 create', async () => {
    tabsQuery.mockResolvedValue([
      { id: 7, windowId: 1, url: 'chrome-extension://x/library.html' }
    ] as chrome.tabs.Tab[])

    const result = await focusOrOpenTab({
      targetUrl: 'chrome-extension://x/library.html',
      match: { kind: 'urlPatterns', patterns: 'chrome-extension://x/library.html*' },
      logScope: 'ExtensionTab'
    })

    expect(result).toEqual({ status: 'focused', tabId: 7, navigated: false })
    expect(tabsCreate).not.toHaveBeenCalled()
    expect(tabsUpdate).toHaveBeenCalledWith(7, { active: true })
    expect(windowsUpdate).toHaveBeenCalledWith(1, { focused: true })
  })

  it('canKeepExistingUrl 为 true 时只激活不改址', async () => {
    tabsQuery.mockResolvedValue([
      {
        id: 3,
        windowId: 2,
        url: 'http://localhost:3001/login?connect_extension=1&extension_id=ext-1'
      }
    ] as chrome.tabs.Tab[])

    const result = await focusOrOpenTab({
      targetUrl: 'http://localhost:3001/login?connect_extension=1&extension_id=ext-1',
      match: {
        kind: 'predicate',
        match: url => isSameOriginPathTabUrl(url, 'http://localhost:3001', '/login')
      },
      canKeepExistingUrl: current =>
        current.searchParams.get('connect_extension') === '1' &&
        current.searchParams.get('extension_id') === 'ext-1',
      logScope: 'Auth'
    })

    expect(result).toEqual({ status: 'focused', tabId: 3, navigated: false })
    expect(tabsUpdate).toHaveBeenCalledWith(3, { active: true })
  })

  it('无命中则 create 并可选记 sessionKey', async () => {
    tabsQuery.mockResolvedValue([])
    tabsCreate.mockResolvedValue({ id: 99, windowId: 4 } as chrome.tabs.Tab)

    const result = await focusOrOpenTab({
      targetUrl: 'chrome-extension://x/settings.html',
      match: { kind: 'urlPatterns', patterns: 'chrome-extension://x/settings.html*' },
      sessionKey: 'yiveno.settingsTabId',
      logScope: 'ExtensionTab'
    })

    expect(result).toEqual({ status: 'created', tabId: 99 })
    expect(sessionSet).toHaveBeenCalledWith({ 'yiveno.settingsTabId': 99 })
  })

  it('activateOnReuse false：改址不抢焦点', async () => {
    tabsQuery.mockResolvedValue([
      { id: 5, windowId: 1, url: 'http://localhost:3001/account' }
    ] as chrome.tabs.Tab[])

    const result = await focusOrOpenTab({
      targetUrl: 'http://localhost:3001/logout?from_extension=1',
      match: {
        kind: 'predicate',
        match: url => url.startsWith('http://localhost:3001')
      },
      canKeepExistingUrl: () => false,
      activateOnReuse: false,
      activeOnCreate: false,
      focusWindow: false,
      logScope: 'Auth'
    })

    expect(result).toEqual({ status: 'focused', tabId: 5, navigated: true })
    expect(tabsUpdate).toHaveBeenCalledWith(5, {
      url: 'http://localhost:3001/logout?from_extension=1'
    })
    expect(windowsUpdate).not.toHaveBeenCalled()
  })

  it('forceNew 跳过匹配直接 create', async () => {
    tabsCreate.mockResolvedValue({ id: 1 } as chrome.tabs.Tab)

    const result = await focusOrOpenTab({
      targetUrl: 'http://localhost:3001/login',
      match: { kind: 'predicate', match: () => true },
      forceNew: true,
      logScope: 'Auth'
    })

    expect(tabsQuery).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'created', tabId: 1 })
  })
})
