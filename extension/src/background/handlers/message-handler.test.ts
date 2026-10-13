import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))
const handleOpenRecallShellMock = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/background/handlers/commands-handler', async () => {
  const actual = await vi.importActual<typeof import('@/background/handlers/commands-handler')>(
    '@/background/handlers/commands-handler'
  )
  return {
    ...actual,
    handleOpenRecallShell: handleOpenRecallShellMock
  }
})

import { handleBackgroundMessage } from '@/background/handlers/message-handler'
import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import { UI_MESSAGE_SCOPE } from '@/core/messaging/ui-messages'

describe('handleBackgroundMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureBackgroundBootstrappedMock.mockResolvedValue(undefined)
    handleOpenRecallShellMock.mockResolvedValue({ ok: true })
  })

  it('非 background scope 返回 false 且不调用 sendResponse', () => {
    const sendResponse = vi.fn()
    const handled = handleBackgroundMessage(
      { scope: UI_MESSAGE_SCOPE, type: 'CHROME_BOOKMARK_TREE_CHANGED' },
      sendResponse
    )
    expect(handled).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
    expect(ensureBackgroundBootstrappedMock).not.toHaveBeenCalled()
  })

  it('未知 background type 返回 UNKNOWN_MESSAGE_TYPE', async () => {
    const sendResponse = vi.fn()
    const handled = handleBackgroundMessage(
      { scope: BACKGROUND_MESSAGE_SCOPE, type: 'NOT_A_REAL_TYPE' },
      sendResponse
    )
    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })
    expect(ensureBackgroundBootstrappedMock).toHaveBeenCalledTimes(1)
    expect(sendResponse.mock.calls[0]?.[0]).toEqual({
      ok: false,
      errorCode: 'UNKNOWN_MESSAGE_TYPE',
      error: '未知消息类型: NOT_A_REAL_TYPE'
    })
  })

  it('PING 异步响应 ok:true 且不 await bootstrap', async () => {
    const sendResponse = vi.fn()
    const handled = handleBackgroundMessage(
      { scope: BACKGROUND_MESSAGE_SCOPE, type: 'PING' },
      sendResponse
    )
    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    expect(ensureBackgroundBootstrappedMock).not.toHaveBeenCalled()
  })

  it('OPEN_RECALL_SHELL 不 await bootstrap（保用户手势）', async () => {
    const sendResponse = vi.fn()
    const handled = handleBackgroundMessage(
      { scope: BACKGROUND_MESSAGE_SCOPE, type: 'OPEN_RECALL_SHELL' },
      sendResponse,
      { tab: { id: 7, windowId: 1 } } as chrome.runtime.MessageSender
    )
    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    expect(ensureBackgroundBootstrappedMock).not.toHaveBeenCalled()
    expect(handleOpenRecallShellMock).toHaveBeenCalledWith({ tabId: 7, windowId: 1 })
  })
})
