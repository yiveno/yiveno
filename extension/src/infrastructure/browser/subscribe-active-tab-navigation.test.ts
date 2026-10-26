import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  shouldRefreshOnTabUpdated,
  shouldRefreshOnWindowFocusChanged,
  subscribeActiveTabNavigation
} from '@/infrastructure/browser/subscribe-active-tab-navigation'

describe('subscribe-active-tab-navigation', () => {
  const onActivated = { addListener: vi.fn(), removeListener: vi.fn() }
  const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }
  const onFocusChanged = { addListener: vi.fn(), removeListener: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      tabs: { onActivated, onUpdated },
      windows: {
        WINDOW_ID_NONE: -1,
        onFocusChanged
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shouldRefreshOnTabUpdated：url / complete 才刷新', () => {
    expect(shouldRefreshOnTabUpdated({ url: 'https://a.example' })).toBe(true)
    expect(shouldRefreshOnTabUpdated({ status: 'complete' })).toBe(true)
    expect(shouldRefreshOnTabUpdated({ status: 'loading' })).toBe(false)
    expect(shouldRefreshOnTabUpdated({})).toBe(false)
  })

  it('shouldRefreshOnWindowFocusChanged：忽略 WINDOW_ID_NONE', () => {
    expect(shouldRefreshOnWindowFocusChanged(-1)).toBe(false)
    expect(shouldRefreshOnWindowFocusChanged(1)).toBe(true)
  })

  it('subscribe：挂载三路监听；unsubscribe 卸下；回调过滤正确', () => {
    const onNavigate = vi.fn()
    const stop = subscribeActiveTabNavigation(onNavigate)

    expect(onActivated.addListener).toHaveBeenCalledTimes(1)
    expect(onUpdated.addListener).toHaveBeenCalledTimes(1)
    expect(onFocusChanged.addListener).toHaveBeenCalledTimes(1)

    const activated = onActivated.addListener.mock.calls[0]![0] as () => void
    const updated = onUpdated.addListener.mock.calls[0]![0] as (
      tabId: number,
      changeInfo: { url?: string; status?: string }
    ) => void
    const focus = onFocusChanged.addListener.mock.calls[0]![0] as (windowId: number) => void

    activated()
    updated(1, { status: 'loading' })
    updated(1, { url: 'https://b.example' })
    focus(-1)
    focus(2)

    expect(onNavigate).toHaveBeenCalledTimes(3)

    stop()
    expect(onActivated.removeListener).toHaveBeenCalledWith(activated)
    expect(onUpdated.removeListener).toHaveBeenCalledWith(updated)
    expect(onFocusChanged.removeListener).toHaveBeenCalledWith(focus)
  })
})
