import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/auth/device-label', () => ({
  getDeviceLabelAndPlatform: vi.fn(() => ({
    deviceLabel: 'Chrome on macOS',
    platform: 'macOS'
  }))
}))

import { registerDeviceViaSessionExchange } from './device-register-api-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('registerDeviceViaSessionExchange', () => {
  it('POST body 含 mode + deviceLabel + platform', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            deviceToken: 'ydt_' + 'a'.repeat(64),
            deviceId: '33333333-3333-4333-8333-333333333333',
            userId: '22222222-2222-4222-8222-222222222222',
            email: null,
            displayName: null,
            avatarUrl: null,
            isAnonymous: true
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    globalThis.fetch = fetchMock as typeof fetch

    const result = await registerDeviceViaSessionExchange('supabase-access')
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/device-register'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer supabase-access'
        })
      })
    )
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
    expect(body).toEqual({
      mode: 'session_exchange',
      deviceLabel: 'Chrome on macOS',
      platform: 'macOS'
    })
  })
})
