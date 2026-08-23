import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  focusOrOpenLibraryTab,
  focusOrOpenSettingsTab
} from '@/infrastructure/browser/extension-tab'

describe('extension-tab', () => {
  const sessionStore = new Map<string, unknown>()

  beforeEach(() => {
    sessionStore.clear()
    vi.clearAllMocks()

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
        get: vi.fn(),
        query: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
        create: vi.fn(async () => ({ id: 42 }))
      },
      windows: {
        update: vi.fn(async () => undefined)
      }
    })
  })

  it('focusOrOpenLibraryTab 首次创建并记住 tabId；再次则聚焦', async () => {
    await focusOrOpenLibraryTab()
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/library.html'
    })
    expect(sessionStore.get('yiveno.libraryTabId')).toBe(42)

    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 42,
      windowId: 7
    } as chrome.tabs.Tab)

    await focusOrOpenLibraryTab()
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1)
    expect(chrome.tabs.update).toHaveBeenCalledWith(42, { active: true })
    expect(chrome.windows.update).toHaveBeenCalledWith(7, { focused: true })
  })

  it('focusOrOpenLibraryTab 在旧 tab 失效时重建', async () => {
    sessionStore.set('yiveno.libraryTabId', 9)
    vi.mocked(chrome.tabs.get).mockRejectedValue(new Error('No tab'))
    vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 55 } as chrome.tabs.Tab)

    await focusOrOpenLibraryTab()
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1)
    expect(sessionStore.get('yiveno.libraryTabId')).toBe(55)
  })

  it('focusOrOpenLibraryTab 无 session 时按 URL 找到已开标签', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      {
        id: 77,
        windowId: 3,
        url: 'chrome-extension://test/library.html'
      } as chrome.tabs.Tab
    ])
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 77,
      windowId: 3
    } as chrome.tabs.Tab)

    await focusOrOpenLibraryTab()
    expect(chrome.tabs.create).not.toHaveBeenCalled()
    expect(chrome.tabs.update).toHaveBeenCalledWith(77, { active: true })
    expect(sessionStore.get('yiveno.libraryTabId')).toBe(77)
  })

  it('focusOrOpenSettingsTab 优先 openOptionsPage', async () => {
    await focusOrOpenSettingsTab()
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledTimes(1)
    expect(chrome.tabs.create).not.toHaveBeenCalled()
  })
})
