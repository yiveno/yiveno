import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  handleGetExtensionCommands,
  handleOpenChromeShortcutsPage,
  handleOpenRecallShell
} from '@/background/handlers/commands-handler'
import { CHROME_EXTENSION_SHORTCUTS_URL } from '@/core/commands/command-display'

describe('commands-handler', () => {
  const getAll = vi.fn()
  const tabsCreate = vi.fn(async () => undefined)
  const sidePanelOpen = vi.fn(async () => undefined)
  const windowsGetCurrent = vi.fn(async () => ({ id: 42 }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      commands: { getAll },
      tabs: { create: tabsCreate },
      windows: { getCurrent: windowsGetCurrent },
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        open: sidePanelOpen
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

  it('handleOpenChromeShortcutsPage 打开原生设置页', async () => {
    const response = await handleOpenChromeShortcutsPage()
    expect(response).toEqual({ ok: true })
    expect(tabsCreate).toHaveBeenCalledWith({ url: CHROME_EXTENSION_SHORTCUTS_URL })
  })

  it('handleOpenRecallShell 打开 Side Panel（windowId）', async () => {
    const response = await handleOpenRecallShell()
    expect(response).toEqual({ ok: true })
    expect(windowsGetCurrent).toHaveBeenCalled()
    expect(sidePanelOpen).toHaveBeenCalledWith({ windowId: 42 })
  })

  it('handleOpenRecallShell 优先使用 tabId', async () => {
    const response = await handleOpenRecallShell({ tabId: 7 })
    expect(response).toEqual({ ok: true })
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 7 })
    expect(windowsGetCurrent).not.toHaveBeenCalled()
  })
})
