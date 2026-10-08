import { beforeEach, describe, expect, it, vi } from 'vitest'

import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import { createMockTabsCreate, createMockTabsQuery } from '@/tests/chrome-mock'

describe('navigateTabToUrl', () => {
  const tabsQuery = createMockTabsQuery()
  const tabsCreate = createMockTabsCreate()
  const tabsUpdate = vi.fn(async () => undefined)
  const windowsUpdate = vi.fn(async () => undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    tabsQuery.mockResolvedValue([])
    tabsCreate.mockResolvedValue({ id: 99 } as chrome.tabs.Tab)
    vi.stubGlobal('chrome', {
      tabs: {
        query: tabsQuery,
        update: tabsUpdate,
        create: tabsCreate
      },
      windows: {
        update: windowsUpdate
      }
    })
  })

  it('currentTab：更新 lastFocused 活动标签', async () => {
    tabsQuery.mockResolvedValue([{ id: 7, windowId: 1 } as chrome.tabs.Tab])
    await navigateTabToUrl('https://example.com/a', 'currentTab')
    expect(tabsUpdate).toHaveBeenCalledWith(7, {
      url: 'https://example.com/a',
      active: true
    })
    expect(windowsUpdate).toHaveBeenCalledWith(1, { focused: true })
    expect(tabsCreate).not.toHaveBeenCalled()
  })

  it('newForegroundTab：始终新建', async () => {
    await navigateTabToUrl('https://example.com/b', 'newForegroundTab')
    expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://example.com/b' })
    expect(tabsUpdate).not.toHaveBeenCalled()
  })

  it('无活动标签时降级新建', async () => {
    tabsQuery.mockResolvedValue([])
    await navigateTabToUrl('https://example.com/c', 'currentTab')
    expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://example.com/c' })
  })

  it('拒绝不可导航 URL', async () => {
    await expect(navigateTabToUrl('javascript:alert(1)', 'currentTab')).rejects.toThrow(
      'NAVIGATE_URL_INVALID'
    )
  })
})
