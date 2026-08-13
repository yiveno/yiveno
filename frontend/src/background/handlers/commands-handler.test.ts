import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  handleGetExtensionCommands,
  handleOpenChromeShortcutsPage,
  handleOpenRecallPopup
} from '@/background/handlers/commands-handler'
import { CHROME_EXTENSION_SHORTCUTS_URL } from '@/core/commands/command-display'

describe('commands-handler', () => {
  const getAll = vi.fn()
  const tabsCreate = vi.fn(async () => undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      commands: { getAll },
      tabs: { create: tabsCreate }
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

  it('handleOpenRecallPopup 打开 Recall Popup', async () => {
    const openPopup = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      commands: { getAll },
      tabs: { create: tabsCreate },
      action: { openPopup }
    })

    const response = await handleOpenRecallPopup()
    expect(response).toEqual({ ok: true })
    expect(openPopup).toHaveBeenCalledTimes(1)
  })
})
