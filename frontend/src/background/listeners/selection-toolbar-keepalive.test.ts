import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SELECTION_TOOLBAR_KEEPALIVE_PORT } from '@/core/messaging/content-messages'
import {
  registerSelectionToolbarKeepaliveListener,
  resetSelectionToolbarKeepaliveListenerForTests
} from '@/background/listeners/selection-toolbar-keepalive'

describe('selection-toolbar-keepalive', () => {
  let onConnectHandler: ((port: chrome.runtime.Port) => void) | null = null

  beforeEach(() => {
    resetSelectionToolbarKeepaliveListenerForTests()
    onConnectHandler = null
    vi.stubGlobal('chrome', {
      runtime: {
        onConnect: {
          addListener: vi.fn((handler: (port: chrome.runtime.Port) => void) => {
            onConnectHandler = handler
          })
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('注册后承接划词 keepalive port，忽略其它 port', () => {
    registerSelectionToolbarKeepaliveListener()
    registerSelectionToolbarKeepaliveListener()
    expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledTimes(1)

    const disconnect = vi.fn()
    onConnectHandler?.({
      name: SELECTION_TOOLBAR_KEEPALIVE_PORT,
      onDisconnect: { addListener: disconnect }
    } as unknown as chrome.runtime.Port)
    expect(disconnect).toHaveBeenCalledTimes(1)

    const otherDisconnect = vi.fn()
    onConnectHandler?.({
      name: 'other',
      onDisconnect: { addListener: otherDisconnect }
    } as unknown as chrome.runtime.Port)
    expect(otherDisconnect).not.toHaveBeenCalled()
  })
})
