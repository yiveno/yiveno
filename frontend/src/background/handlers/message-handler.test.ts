import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

import { handleBackgroundMessage } from '@/background/handlers/message-handler'
import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import { UI_MESSAGE_SCOPE } from '@/core/messaging/ui-messages'

describe('handleBackgroundMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureBackgroundBootstrappedMock.mockResolvedValue(undefined)
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
})
