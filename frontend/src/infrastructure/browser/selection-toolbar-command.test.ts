import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SELECTION_TOOLBAR_PAGE_API_KEY } from '@/core/messaging/content-messages'
import {
  dispatchSelectionToolbarCommand,
  SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE
} from '@/infrastructure/browser/selection-toolbar-command'

describe('dispatchSelectionToolbarCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn(async () => [{ id: 7, url: 'https://example.com', title: 'Example' }])
      },
      scripting: {
        executeScript: vi.fn()
      },
      action: {
        setBadgeText: vi.fn(async () => undefined),
        setBadgeBackgroundColor: vi.fn(async () => undefined)
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('页内返回 skipped 时忽略', async () => {
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { result: { ok: true, skipped: true } }
    ] as never)

    await expect(dispatchSelectionToolbarCommand('SELECTION_SAVE')).resolves.toEqual({
      status: 'ignored'
    })
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled()
  })

  it('页内 API 可用时直接成功', async () => {
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: { ok: true } }] as never)

    await expect(dispatchSelectionToolbarCommand('SELECTION_SAVE')).resolves.toEqual({
      status: 'ok'
    })
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1)
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 7 },
        args: ['SELECTION_SAVE', SELECTION_TOOLBAR_PAGE_API_KEY]
      })
    )
  })

  it('缺少 API 时注入脚本并重试', async () => {
    vi.mocked(chrome.scripting.executeScript)
      .mockResolvedValueOnce([{ result: { ok: false, missingApi: true } }] as never)
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce([{ result: { ok: true } }] as never)

    const pending = dispatchSelectionToolbarCommand('SELECTION_OPEN_NOTE')
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toEqual({ status: 'ok' })

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: [SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE]
    })
  })

  it('注入后仍无 API 返回 no_receiver', async () => {
    vi.mocked(chrome.scripting.executeScript).mockImplementation(async details => {
      if (details && 'files' in details) {
        return undefined as never
      }
      return [{ result: { ok: false, missingApi: true } }] as never
    })

    const pending = dispatchSelectionToolbarCommand('SELECTION_SAVE')
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toEqual({ status: 'no_receiver' })
  })
})
