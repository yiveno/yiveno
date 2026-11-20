import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  registerDeviceFromWebsite,
  rollbackIssuedDeviceToken
} from './register-device-from-website'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const okData = {
  deviceToken: 'ydt_' + 'a'.repeat(64),
  deviceId: '33333333-3333-4333-8333-333333333333',
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'u@example.com',
  displayName: 'User',
  avatarUrl: null,
  isAnonymous: false,
  uninstallRevokeToken: null
}

describe('registerDeviceFromWebsite', () => {
  it('成功映射 register data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: okData }), { status: 200 })
      )
    vi.stubGlobal('fetch', fetchMock)
    const result = await registerDeviceFromWebsite('website-at', { extensionId: 'ext-a' })
    expect(result).toEqual({ status: 'ok', data: okData })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/device-register'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer website-at' })
      })
    )
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
    expect(body).toEqual({ mode: 'website_connect', extensionId: 'ext-a' })
  })

  it('401 → unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 })
        )
    )
    const result = await registerDeviceFromWebsite('stale')
    expect(result).toEqual({ status: 'unauthorized', error: 'invalid_token' })
  })

  it('非 401 失败 → failed + httpStatus', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'kv_unavailable' }), { status: 503 })
        )
    )
    const result = await registerDeviceFromWebsite('tok')
    expect(result).toEqual({
      status: 'failed',
      error: 'kv_unavailable',
      httpStatus: 503
    })
  })

  it('响应缺字段 → failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { deviceToken: 'short', userId: 'x', isAnonymous: false }
          }),
          { status: 200 }
        )
      )
    )
    const result = await registerDeviceFromWebsite('tok')
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.error).toBe('invalid_device_register_response')
    }
  })

  it('空 access → failed', async () => {
    const result = await registerDeviceFromWebsite('  ')
    expect(result).toEqual({ status: 'failed', error: 'missing_website_access_token' })
  })
})

describe('rollbackIssuedDeviceToken', () => {
  it('成功调 device-revoke-self', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const token = 'ydt_' + 'b'.repeat(64)
    expect(await rollbackIssuedDeviceToken(token)).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/device-revoke-self'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: `Bearer ${token}` })
      })
    )
  })

  it('空 token → false', async () => {
    expect(await rollbackIssuedDeviceToken(undefined)).toBe(false)
    expect(await rollbackIssuedDeviceToken('  ')).toBe(false)
  })
})
