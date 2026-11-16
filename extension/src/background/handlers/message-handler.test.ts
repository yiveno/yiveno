import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))
const handleOpenRecallShellMock = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })))
const handleImportLocalMemoryMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<
      | {
          ok: true
          restoredItems: number
          skippedItems: number
          restoredNotes: number
          skippedNotes: number
        }
      | { ok: false; errorCode: 'LOCAL_IMPORT_INVALID_FORMAT'; error: string }
    > => ({
      ok: true,
      restoredItems: 1,
      skippedItems: 0,
      restoredNotes: 0,
      skippedNotes: 0
    })
  )
)

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

vi.mock('@/background/handlers/import-handler', async () => {
  const actual = await vi.importActual<typeof import('@/background/handlers/import-handler')>(
    '@/background/handlers/import-handler'
  )
  return {
    ...actual,
    handleImportLocalMemory: handleImportLocalMemoryMock
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
    expect(handleOpenRecallShellMock).toHaveBeenCalledWith({ tabId: 7, windowId: 1 }, {})
  })

  it('OPEN_RECALL_SHELL 带选区预填 payload 原样下传', async () => {
    const sendResponse = vi.fn()
    const handled = handleBackgroundMessage(
      {
        scope: BACKGROUND_MESSAGE_SCOPE,
        type: 'OPEN_RECALL_SHELL',
        payload: { clue: 'unsaturated substrate', autoSubmit: false }
      },
      sendResponse,
      { tab: { id: 3, windowId: 9 } } as chrome.runtime.MessageSender
    )
    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    expect(handleOpenRecallShellMock).toHaveBeenCalledWith(
      { tabId: 3, windowId: 9 },
      { clue: 'unsaturated substrate', autoSubmit: false }
    )
  })

  it('IMPORT_LOCAL_MEMORY 分发到 handleImportLocalMemory', async () => {
    handleImportLocalMemoryMock.mockResolvedValueOnce({
      ok: true,
      restoredItems: 2,
      skippedItems: 1,
      restoredNotes: 3,
      skippedNotes: 0
    })
    const sendResponse = vi.fn()
    const payload = { content: '{"formatVersion":1,"ownerId":"x","items":[]}' }
    const handled = handleBackgroundMessage(
      {
        scope: BACKGROUND_MESSAGE_SCOPE,
        type: 'IMPORT_LOCAL_MEMORY',
        payload
      },
      sendResponse
    )
    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })
    expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
    expect(handleImportLocalMemoryMock).toHaveBeenCalledWith(payload)
    expect(sendResponse.mock.calls[0]?.[0]).toEqual({
      ok: true,
      restoredItems: 2,
      skippedItems: 1,
      restoredNotes: 3,
      skippedNotes: 0
    })
  })

  it('IMPORT_LOCAL_MEMORY service 抛错 → 类型化错误响应', async () => {
    handleImportLocalMemoryMock.mockResolvedValueOnce({
      ok: false,
      errorCode: 'LOCAL_IMPORT_INVALID_FORMAT',
      error: 'LOCAL_IMPORT_INVALID_FORMAT'
    })
    const sendResponse = vi.fn()
    const handled = handleBackgroundMessage(
      {
        scope: BACKGROUND_MESSAGE_SCOPE,
        type: 'IMPORT_LOCAL_MEMORY',
        payload: { content: '{' }
      },
      sendResponse
    )
    expect(handled).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })
    expect(sendResponse.mock.calls[0]?.[0]).toEqual({
      ok: false,
      errorCode: 'LOCAL_IMPORT_INVALID_FORMAT',
      error: 'LOCAL_IMPORT_INVALID_FORMAT'
    })
  })
})
