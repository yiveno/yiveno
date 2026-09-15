import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ensureSidePanelOpensOnActionClick,
  openRecallSidePanel,
  openRecallSidePanelFromExtensionPage
} from './side-panel'

describe('side-panel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('ensureSidePanelOpensOnActionClick 调用 setPanelBehavior', async () => {
    const setPanelBehavior = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      sidePanel: { setPanelBehavior, open: vi.fn() }
    })

    await ensureSidePanelOpensOnActionClick()

    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true })
  })

  it('ensureSidePanelOpensOnActionClick：API 不可用时不抛错', async () => {
    vi.stubGlobal('chrome', {})
    await expect(ensureSidePanelOpensOnActionClick()).resolves.toBeUndefined()
  })

  it('openRecallSidePanel 优先 tabId', async () => {
    const open = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      sidePanel: { setPanelBehavior: vi.fn(), open },
      windows: { getCurrent: vi.fn(), WINDOW_ID_CURRENT: -2 }
    })

    await openRecallSidePanel({ tabId: 3 })
    expect(open).toHaveBeenCalledWith({ tabId: 3 })
  })

  it('openRecallSidePanel 无上下文时用 WINDOW_ID_CURRENT（不 await getCurrent）', async () => {
    const open = vi.fn(async () => undefined)
    const getCurrent = vi.fn(async () => ({ id: 9 }))
    vi.stubGlobal('chrome', {
      sidePanel: { setPanelBehavior: vi.fn(), open },
      windows: { getCurrent, WINDOW_ID_CURRENT: -2 }
    })

    await openRecallSidePanel()
    expect(getCurrent).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith({ windowId: -2 })
  })

  it('openRecallSidePanelFromExtensionPage 走 WINDOW_ID_CURRENT', async () => {
    const open = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      sidePanel: { setPanelBehavior: vi.fn(), open },
      windows: { WINDOW_ID_CURRENT: -2 }
    })

    await openRecallSidePanelFromExtensionPage()
    expect(open).toHaveBeenCalledWith({ windowId: -2 })
  })
})
