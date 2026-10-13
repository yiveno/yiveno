import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import { sendBackgroundMessage } from '@/infrastructure/messaging/background-client'

describe('sendBackgroundMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runtime 抛错时返回 MESSAGE_DISPATCH_FAILED', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn().mockRejectedValue(new Error('Receiving end does not exist'))
      }
    })

    const result = await sendBackgroundMessage({
      scope: BACKGROUND_MESSAGE_SCOPE,
      type: 'PING'
    })

    expect(result).toEqual({
      ok: false,
      errorCode: 'MESSAGE_DISPATCH_FAILED',
      error: 'Receiving end does not exist'
    })
  })

  it('undefined 响应时返回 MESSAGE_DISPATCH_FAILED', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined)
      }
    })

    const result = await sendBackgroundMessage({
      scope: BACKGROUND_MESSAGE_SCOPE,
      type: 'PING'
    })

    expect(result).toEqual({
      ok: false,
      errorCode: 'MESSAGE_DISPATCH_FAILED',
      error: 'Background 无响应'
    })
  })
})
