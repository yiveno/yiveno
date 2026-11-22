import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { claimByOtpApi, requestBindCodeApi, verifyBindCodeApi } from './bind-otp-api-client'

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

vi.mock('@/infrastructure/auth/device-label', () => ({
  getDeviceLabelAndPlatform: () => ({ deviceLabel: 'Chrome on macOS', platform: 'macOS' })
}))

describe('bind-otp-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requestBindCodeApi 成功', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )
    const result = await requestBindCodeApi({
      deviceToken: 'ydt_' + 'a'.repeat(64),
      email: 'a@b.com',
      turnstileToken: 'cf-token',
      locale: 'en'
    })
    expect(result).toEqual({ ok: true })
  })

  it('verifyBindCodeApi 成功返回 branch', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { branch: 'claim', claimToken: 'c'.repeat(64) }
        }),
        { status: 200 }
      )
    )
    const result = await verifyBindCodeApi({
      deviceToken: 'ydt_' + 'a'.repeat(64),
      email: 'a@b.com',
      code: '12345678'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.branch).toBe('claim')
  })

  it('verifyBindCodeApi invalid_code 透传 remainingAttempts', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_code', remainingAttempts: 3 }), {
        status: 400
      })
    )
    const result = await verifyBindCodeApi({
      deviceToken: 'ydt_' + 'a'.repeat(64),
      email: 'a@b.com',
      code: '00000000'
    })
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_code',
      remainingAttempts: 3
    })
  })

  it('claimByOtpApi 成功映射 device 数据', async () => {
    const data = {
      deviceToken: 'ydt_' + 'b'.repeat(64),
      deviceId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'u@x.com',
      displayName: null,
      avatarUrl: null,
      isAnonymous: false
    }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, data }), { status: 200 })
    )
    const result = await claimByOtpApi({
      deviceToken: 'ydt_' + 'a'.repeat(64),
      claimToken: 'c'.repeat(64)
    })
    expect(result).toEqual({ ok: true, data })
  })
})
