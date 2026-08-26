import { beforeEach, describe, expect, it, vi } from 'vitest'

import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'

describe('navigateTabToUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
        create: vi.fn(async () => ({ id: 99 }) as chrome.tabs.Tab)
      },
      windows: {
        update: vi.fn(async () => undefined)
      }
    })
  })

  it('currentTab：更新 lastFocused 活动标签', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 7, windowId: 1 } as chrome.tabs.Tab])
    await navigateTabToUrl('https://example.com/a', 'currentTab')
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, {
      url: 'https://example.com/a',
      active: true
    })
    expect(chrome.windows.update).toHaveBeenCalledWith(1, { focused: true })
    expect(chrome.tabs.create).not.toHaveBeenCalled()
  })

  it('newForegroundTab：始终新建', async () => {
    await navigateTabToUrl('https://example.com/b', 'newForegroundTab')
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com/b' })
    expect(chrome.tabs.update).not.toHaveBeenCalled()
  })

  it('无活动标签时降级新建', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([])
    await navigateTabToUrl('https://example.com/c', 'currentTab')
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com/c' })
  })

  it('拒绝不可导航 URL', async () => {
    await expect(navigateTabToUrl('javascript:alert(1)', 'currentTab')).rejects.toThrow(
      'NAVIGATE_URL_INVALID'
    )
  })
})
