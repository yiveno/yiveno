import { afterEach, describe, expect, it, vi } from 'vitest'

import { mintExtensionSession } from './mint-extension-session'

describe('mintExtensionSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('409 needs_displace_confirm 解析 existingSessionId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'needs_displace_confirm',
              data: {
                existingMintedAt: '2026-10-01T00:00:00.000Z',
                existingSessionId: 'sess-alive-1'
              }
            }),
            { status: 409 }
          )
      )
    )
    const result = await mintExtensionSession('website-access', { extensionId: 'ext-a' })
    expect(result).toEqual({
      status: 'needs_displace_confirm',
      existingMintedAt: '2026-10-01T00:00:00.000Z',
      existingSessionId: 'sess-alive-1'
    })
  })
})
