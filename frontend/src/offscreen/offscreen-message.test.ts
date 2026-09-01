import { describe, expect, it, vi } from 'vitest'

import {
  handleOffscreenRuntimeMessage,
  isOffscreenPingMessage
} from '@/offscreen/offscreen-message'

describe('offscreen-message', () => {
  it('isOffscreenPingMessage 仅识别 offscreen PING', () => {
    expect(isOffscreenPingMessage({ scope: 'offscreen', type: 'PING' })).toBe(true)
    expect(isOffscreenPingMessage({ scope: 'background', type: 'PING' })).toBe(false)
    expect(isOffscreenPingMessage({ scope: 'offscreen', type: 'CAPTURE' })).toBe(false)
    expect(isOffscreenPingMessage(null)).toBe(false)
  })

  it('handleOffscreenRuntimeMessage：PING 响应 ok 并 return true', () => {
    const sendResponse = vi.fn()

    expect(handleOffscreenRuntimeMessage({ scope: 'offscreen', type: 'PING' }, sendResponse)).toBe(
      true
    )
    expect(sendResponse).toHaveBeenCalledWith({ ok: true })
  })

  it('handleOffscreenRuntimeMessage：非 PING 不响应', () => {
    const sendResponse = vi.fn()

    expect(handleOffscreenRuntimeMessage({ scope: 'background', type: 'PING' }, sendResponse)).toBe(
      false
    )
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
