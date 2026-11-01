import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  handleGetExtensionCommands,
  handleOpenChromeShortcutsPage,
  handleOpenRecallShell
} from '@/background/handlers/commands-handler'
import {
  CHROME_EXTENSION_SHORTCUTS_URL,
  EDGE_EXTENSION_SHORTCUTS_URL
} from '@/core/commands/command-display'

describe('commands-handler', () => {
  const getAll = vi.fn()
  const tabsCreate = vi.fn(async () => undefined)
  const sidePanelOpen = vi.fn(async () => undefined)
  const windowsGetCurrent = vi.fn(async () => ({ id: 42 }))

  const sessionSet = vi.fn(async () => undefined)
  const sessionRemove = vi.fn(async () => undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      commands: { getAll },
      tabs: { create: tabsCreate },
      windows: { getCurrent: windowsGetCurrent, WINDOW_ID_CURRENT: -2 },
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        open: sidePanelOpen
      },
      storage: {
        session: {
          set: sessionSet,
          remove: sessionRemove,
          get: vi.fn(async () => ({}))
        }
      }
    })
  })

  it('handleGetExtensionCommands 返回规范化列表', async () => {
    getAll.mockResolvedValue([
      {
        name: '_execute_action',
        description: 'Open Yiveno Recall',
        shortcut: 'Alt+Shift+Y'
      },
      { description: 'orphan' }
    ])

    const response = await handleGetExtensionCommands()
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.commands).toEqual([
      {
        name: '_execute_action',
        description: 'Open Yiveno Recall',
        shortcut: 'Alt+Shift+Y'
      }
    ])
  })

  it('handleOpenChromeShortcutsPage 打开 Chrome 快捷键页', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' })
    const response = await handleOpenChromeShortcutsPage()
    expect(response).toEqual({ ok: true })
    expect(tabsCreate).toHaveBeenCalledWith({ url: CHROME_EXTENSION_SHORTCUTS_URL })
  })

  it('handleOpenChromeShortcutsPage 在 Edge 打开 edge:// 快捷键页', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Edg/120.0.0.0 Chrome/120.0.0.0 Safari/537.36'
    })
    const response = await handleOpenChromeShortcutsPage()
    expect(response).toEqual({ ok: true })
    expect(tabsCreate).toHaveBeenCalledWith({ url: EDGE_EXTENSION_SHORTCUTS_URL })
  })

  it('handleOpenRecallShell 打开 Side Panel（WINDOW_ID_CURRENT）', async () => {
    const response = await handleOpenRecallShell()
    expect(response).toEqual({ ok: true })
    expect(windowsGetCurrent).not.toHaveBeenCalled()
    expect(sidePanelOpen).toHaveBeenCalledWith({ windowId: -2 })
  })

  it('handleOpenRecallShell 优先使用 tabId', async () => {
    const response = await handleOpenRecallShell({ tabId: 7 })
    expect(response).toEqual({ ok: true })
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 7 })
    expect(windowsGetCurrent).not.toHaveBeenCalled()
  })

  it('handleOpenRecallShell 带 clue：先 open 再写预填（autoSubmit false）', async () => {
    const order: string[] = []
    sidePanelOpen.mockImplementation(async () => {
      order.push('open')
    })
    sessionSet.mockImplementation(async () => {
      order.push('write')
    })

    const response = await handleOpenRecallShell(
      { tabId: 7 },
      { clue: 'hydration reaction', autoSubmit: false }
    )
    expect(response).toEqual({ ok: true })
    expect(order).toEqual(['open', 'write'])
    expect(sessionSet).toHaveBeenCalledWith({
      'yiveno.recallPrefill': { clue: 'hydration reaction', autoSubmit: false }
    })
  })

  it('handleOpenRecallShell：open 失败但预填已写 → 仍 ok', async () => {
    sidePanelOpen.mockRejectedValueOnce(new Error('already open / gesture'))
    const response = await handleOpenRecallShell(
      { tabId: 7 },
      { clue: 'anne carson', autoSubmit: false }
    )
    expect(response).toEqual({ ok: true })
    expect(sessionSet).toHaveBeenCalled()
  })
})
