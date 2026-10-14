import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildExtensionPageTabQueryPattern,
  focusOrOpenGettingStartedTab,
  focusOrOpenLibraryTab,
  focusOrOpenSettingsTab
} from '@/infrastructure/browser/extension-tab'
import { createMockTabsCreate, createMockTabsGet, createMockTabsQuery } from '@/tests/chrome-mock'

describe('extension-tab', () => {
  const sessionStore = new Map<string, unknown>()
  const tabsGet = createMockTabsGet()
  const tabsQuery = createMockTabsQuery()
  const tabsCreate = createMockTabsCreate()
  const tabsUpdate = vi.fn(async () => undefined)
  const windowsUpdate = vi.fn(async () => undefined)

  beforeEach(() => {
    sessionStore.clear()
    vi.clearAllMocks()
    tabsQuery.mockResolvedValue([])
    tabsCreate.mockResolvedValue({ id: 42 } as chrome.tabs.Tab)

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        openOptionsPage: vi.fn(async () => undefined)
      },
      storage: {
        session: {
          get: vi.fn(async (key: string) => {
            const value = sessionStore.get(key)
            return value === undefined ? {} : { [key]: value }
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) {
              sessionStore.set(key, value)
            }
          }),
          remove: vi.fn(async (key: string) => {
            sessionStore.delete(key)
          })
        }
      },
      tabs: {
        get: tabsGet,
        query: tabsQuery,
        update: tabsUpdate,
        create: tabsCreate
      },
      windows: {
        update: windowsUpdate
      }
    })
  })

  it('buildExtensionPageTabQueryPattern 用 url 通配符匹配 query/hash', () => {
    expect(buildExtensionPageTabQueryPattern('library.html')).toBe(
      'chrome-extension://test/library.html*'
    )
  })

  it('focusOrOpenLibraryTab 首次创建并记住 tabId；再次则聚焦', async () => {
    await expect(focusOrOpenLibraryTab()).resolves.toBe(true)
    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'chrome-extension://test/library.html',
      active: true
    })
    expect(sessionStore.get('yiveno.libraryTabId')).toBe(42)

    tabsGet.mockResolvedValue({
      id: 42,
      windowId: 7
    } as chrome.tabs.Tab)

    await focusOrOpenLibraryTab()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(tabsUpdate).toHaveBeenCalledWith(42, { active: true })
    expect(windowsUpdate).toHaveBeenCalledWith(7, { focused: true })
  })

  it('focusOrOpenLibraryTab 在旧 tab 失效时重建', async () => {
    sessionStore.set('yiveno.libraryTabId', 9)
    tabsGet.mockRejectedValue(new Error('No tab'))
    tabsCreate.mockResolvedValue({ id: 55 } as chrome.tabs.Tab)

    await focusOrOpenLibraryTab()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(sessionStore.get('yiveno.libraryTabId')).toBe(55)
  })

  it('focusOrOpenLibraryTab 无 session 时按 URL 找到已开标签', async () => {
    tabsQuery.mockResolvedValue([
      {
        id: 77,
        windowId: 3,
        url: 'chrome-extension://test/library.html'
      } as chrome.tabs.Tab
    ])
    tabsGet.mockResolvedValue({
      id: 77,
      windowId: 3
    } as chrome.tabs.Tab)

    await focusOrOpenLibraryTab()
    expect(tabsQuery).toHaveBeenCalledWith({
      url: 'chrome-extension://test/library.html*'
    })
    expect(tabsCreate).not.toHaveBeenCalled()
    expect(tabsUpdate).toHaveBeenCalledWith(77, { active: true })
    expect(sessionStore.get('yiveno.libraryTabId')).toBe(77)
  })

  it('focusOrOpenSettingsTab 无已有标签时创建并记住 tabId', async () => {
    await focusOrOpenSettingsTab()
    expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled()
    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'chrome-extension://test/settings.html',
      active: true
    })
    expect(sessionStore.get('yiveno.settingsTabId')).toBe(42)
  })

  it('focusOrOpenSettingsTab 按 URL 聚焦已开设置页（含 query）', async () => {
    tabsQuery.mockResolvedValue([
      {
        id: 88,
        windowId: 2,
        url: 'chrome-extension://test/settings.html?section=data'
      } as chrome.tabs.Tab
    ])
    tabsGet.mockResolvedValue({
      id: 88,
      windowId: 2
    } as chrome.tabs.Tab)

    await focusOrOpenSettingsTab()
    expect(tabsQuery).toHaveBeenCalledWith({
      url: 'chrome-extension://test/settings.html*'
    })
    expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled()
    expect(tabsCreate).not.toHaveBeenCalled()
    expect(tabsUpdate).toHaveBeenCalledWith(88, { active: true })
    expect(sessionStore.get('yiveno.settingsTabId')).toBe(88)
  })

  it('focusOrOpenLibraryTab tabs.create 失败时返回 false', async () => {
    tabsCreate.mockRejectedValue(new Error('quota'))

    await expect(focusOrOpenLibraryTab()).resolves.toBe(false)
  })

  it('focusOrOpenGettingStartedTab 按 URL 聚焦已开引导页', async () => {
    tabsQuery.mockResolvedValue([
      {
        id: 91,
        windowId: 4,
        url: 'chrome-extension://test/getting-started.html'
      } as chrome.tabs.Tab
    ])
    tabsGet.mockResolvedValue({
      id: 91,
      windowId: 4
    } as chrome.tabs.Tab)

    await focusOrOpenGettingStartedTab()
    expect(tabsCreate).not.toHaveBeenCalled()
    expect(tabsUpdate).toHaveBeenCalledWith(91, { active: true })
    expect(sessionStore.get('yiveno.gettingStartedTabId')).toBe(91)
  })
})
